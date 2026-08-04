import { Diagnostic, ERROR, Severity, WARNING } from "./errors.js";
import {
  Address,
  BUILTIN_ROOT,
  Declaration,
  Entity,
  Module,
  Link,
  Named,
  Part,
  Prose,
  Reference,
  Statement,
  Value,
  address,
  isStatement,
} from "./nodes.js";
import { World } from "./world.js";

export const LABEL_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;
export const MEANS_MINIMUM = 40;

const TYPE_NAMES: Record<Named["kind"], string> = {
  entity: "an entity",
  enum: "an enum",
  value: "a value",
};

const STATEMENT_NAMES: Record<Statement["kind"], string> = {
  requirement: "a requirement",
  assume: "an assumption",
  exclude: "an exclusion",
};

/** What a name may point at: a declaration, the built-in root, or nothing. */
type Target = Named | "root" | null;

interface Placed {
  readonly line: number;
  readonly column: number;
}

/** A name introduced in one text, and what it was introduced as. */
interface Binding {
  readonly type: Address;
  readonly at: Reference;
}

function meansOf(node: Declaration | Module): Prose | null {
  return "means" in node ? node.means : null;
}

class Resolver {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly index = new Map<string, Map<string, Named>>();
  private readonly labels = new Map<string, [Module, Declaration]>();
  private readonly used = new Set<string>();
  private readonly given = new Set<string>();

  constructor(private readonly world: World) {}

  // --- plumbing -------------------------------------------------------

  private report(
    module: Module, node: Placed, message: string, severity: Severity = ERROR,
    line = 0, column = 0,
  ): void {
    this.diagnostics.push(
      new Diagnostic(
        line || node.line, column || node.column, message, severity, module.path,
      ),
    );
  }

  private qualified(moduleName: string, name: string): string {
    return `${moduleName}:${name}`;
  }

  // --- collecting -----------------------------------------------------

  private collect(): void {
    for (const [name, module] of this.world.modules) {
      const names = new Map<string, Named>();
      for (const node of module.named) {
        const earlier = names.get(node.name);
        if (earlier !== undefined) {
          this.report(module, node,
            `"${node.name}" is already declared on line ${earlier.line}`);
          continue;
        }
        names.set(node.name, node);
      }
      this.index.set(name, names);
    }

    for (const module of this.world.modules.values()) {
      for (const node of module.declarations) {
        const label = "label" in node ? node.label : "";
        if (!label) continue;
        const taken = this.labels.get(label);
        if (taken !== undefined) {
          const [otherModule, other] = taken;
          this.report(module, node,
            `label ${label} is already taken in ${otherModule.path}:${other.line}`);
          continue;
        }
        this.labels.set(label, [module, node]);
      }
    }

    // Gathered over the whole set before anything is reported: an assumption
    // is leant upon from wherever, and a label is not of a module.
    for (const module of this.world.modules.values()) {
      for (const node of module.statements) {
        for (const link of node.given) this.given.add(link.label);
      }
    }
  }

  // --- name resolution -------------------------------------------------

  private lookup(
    module: Module, ref: string, node: Placed, line: number, column: number,
    context: string,
  ): Target {
    if (ref === BUILTIN_ROOT) return "root";

    if (ref.includes(":")) {
      const [moduleName, name] = split(ref);
      if (!this.world.modules.has(moduleName)) {
        this.report(module, node,
          `${context}: module "${moduleName}" is not found`, ERROR, line, column);
        return null;
      }
      if (module.uses.length && !module.uses.includes(moduleName)
        && moduleName !== module.name) {
        this.report(module, node,
          `${context}: module "${moduleName}" is not listed in "uses"`,
          ERROR, line, column);
        return null;
      }
      const target = this.index.get(moduleName)?.get(name);
      if (target === undefined) {
        this.report(module, node,
          `${context}: "${name}" is not declared in module "${moduleName}"`,
          ERROR, line, column);
        return null;
      }
      this.used.add(this.qualified(moduleName, name));
      return target;
    }

    const target = this.index.get(module.name)?.get(ref);
    if (target === undefined) {
      this.report(module, node,
        `${context}: "${ref}" is not declared in module "${module.name}"`,
        ERROR, line, column);
      return null;
    }
    this.used.add(this.qualified(module.name, ref));
    return target;
  }

  // --- checks ----------------------------------------------------------

  check(): Diagnostic[] {
    this.collect();
    for (const module of this.world.modules.values()) {
      this.checkUses(module);
      for (const node of module.declarations) {
        if (node.kind === "entity") this.checkEntity(module, node);
        else if (node.kind === "enum") this.checkEnum(module, node);
        else if (node.kind === "value") this.checkValue(module, node);
        else this.checkStatement(module, node);
        this.checkMeans(module, node);
      }
      this.checkModuleMeans(module);
    }
    this.checkUnused();
    this.checkUnassumed();
    this.diagnostics.sort((one, other) =>
      compare(one.path, other.path) || one.line - other.line
      || one.column - other.column);
    return this.diagnostics;
  }

  private checkUses(module: Module): void {
    for (const name of module.uses) {
      if (!this.world.modules.has(name)) {
        this.report(module, module, `"uses": module "${name}" is not found`,
          ERROR, module.usesLine, 1);
      }
    }
  }

  private checkEntity(module: Module, entity: Entity): void {
    if (entity.supertype) {
      const target = this.lookup(
        module, entity.supertype, entity, entity.supertypeLine,
        entity.supertypeColumn, "supertype",
      );
      if (target !== null && target !== "root" && target.kind !== "entity") {
        this.report(module, entity,
          `supertype "${entity.supertype}" is ${TYPE_NAMES[target.kind]},`
          + " not an entity",
          ERROR, entity.supertypeLine, entity.supertypeColumn);
      }
    }

    const inherited = this.inheritedParts(module, entity);
    const own = new Set<string>();
    for (const part of entity.parts) {
      if (own.has(part.name)) {
        this.report(module, part, `part "${part.name}" is declared twice`);
      } else if (inherited.has(part.name)) {
        this.report(module, part,
          `part "${part.name}" already exists on the supertype`
          + " — overriding is forbidden");
      }
      own.add(part.name);

      const target = this.lookup(module, part.type, part, part.typeLine,
        part.typeColumn, "type of a part");
      if (target === "root") {
        this.report(module, part,
          '"thing" is the top of the hierarchy, not the type of a part',
          ERROR, part.typeLine, part.typeColumn);
      }
    }
  }

  private inheritedParts(
    module: Module, entity: Entity, quiet = false,
  ): Map<string, Part> {
    const parts = new Map<string, Part>();
    const seen = new Set([this.qualified(module.name, entity.name)]);
    let currentModule = module;
    let current: Entity = entity;
    while (current.supertype) {
      const found = this.resolveSilently(currentModule, current.supertype);
      if (found === null) return parts;
      const [owner, node] = found;
      const key = this.qualified(owner.name, node.name);
      if (seen.has(key)) {
        if (!quiet) {
          this.report(currentModule, current,
            `the chain of supertypes closes on "${node.name}"`, ERROR,
            current.supertypeLine || current.line,
            current.supertypeColumn || current.column);
        }
        return parts;
      }
      seen.add(key);
      if (node.kind !== "entity") return parts;
      for (const part of node.parts) {
        if (!parts.has(part.name)) parts.set(part.name, part);
      }
      currentModule = owner;
      current = node;
    }
    return parts;
  }

  /** Every part an entity has: its own and the ones it inherits. */
  private partsOf(module: Module, entity: Entity): Map<string, Part> {
    const parts = this.inheritedParts(module, entity, true);
    for (const part of entity.parts) parts.set(part.name, part);
    return parts;
  }

  private resolveSilently(module: Module, ref: string): [Module, Named] | null {
    if (ref === BUILTIN_ROOT) return null;
    const [moduleName, name] = ref.includes(":") ? split(ref) : [module.name, ref];
    const owner = this.world.modules.get(moduleName);
    const node = this.index.get(moduleName)?.get(name);
    return owner !== undefined && node !== undefined ? [owner, node] : null;
  }

  private checkEnum(module: Module, node: Extract<Named, { kind: "enum" }>): void {
    const seen = new Set<string>();
    for (const value of node.values) {
      if (seen.has(value.name)) {
        this.report(module, value, `value "${value.name}" repeats`);
      }
      seen.add(value.name);
    }
  }

  private checkValue(module: Module, node: Value): void {
    const target = this.lookup(module, node.supertype, node, node.supertypeLine,
      node.supertypeColumn, "supertype of a value");
    if (target !== null && target !== "root" && target.kind !== "value") {
      this.report(module, node,
        `supertype "${node.supertype}" is ${TYPE_NAMES[target.kind]}, not a value`,
        ERROR, node.supertypeLine, node.supertypeColumn);
    }
  }

  private checkStatement(module: Module, node: Declaration): void {
    if (!("states" in node)) return;
    this.checkProse(module, node, node.states, node.because);
    this.checkLinks(module, node);
    if (node.kind === "requirement") {
      const entities = node.states?.references()
        .filter((reference) => !LABEL_RE.test(reference.target)) ?? [];
      if (node.states !== null && !entities.length) {
        this.report(module, node,
          `requirement ${node.label} refers to no entity`, WARNING);
      }
      if (node.because === null) {
        this.report(module, node,
          `requirement ${node.label} without "because"`, WARNING);
      }
    } else if (node.kind === "exclude" && node.because === null) {
      // An exclusion without a reason is doubly useless: its whole value is
      // that the work was declined deliberately.
      const where = node.label ? ` ${node.label}` : "";
      this.report(module, node, `exclusion${where} without "because"`, WARNING);
    }
  }

  /**
   * What one statement says about another: `replaces` and `given`.
   *
   * A link is written where the new statement stands and addresses one that
   * was already there, so nothing has to be edited because something else
   * turned up. What the two things buy differs, and so does what is checked
   * of them: `replaces` decides what is in force, whatever the kinds at
   * either end, and `given` is worth having only if the other end really
   * is an assumption.
   */
  private checkLinks(module: Module, node: Statement): void {
    for (const link of node.replaces) {
      const target = this.statement(module, node, link, "replaces");
      if (target === null) continue;
      if (target === node) {
        this.report(module, node, `"replaces": ${node.label} replaces itself`,
          ERROR, link.line, link.column);
      }
    }

    if (node.label && node.replaces.length && this.closes(node.label)) {
      const [first] = node.replaces;
      this.report(module, node,
        `the chain of "replaces" closes on ${node.label}`,
        ERROR, first.line, first.column);
    }

    for (const link of node.given) {
      const target = this.statement(module, node, link, "given");
      if (target !== null && target.kind !== "assume") {
        this.report(module, node,
          `"given": ${link.label} is ${STATEMENT_NAMES[target.kind]},`
          + " not an assumption",
          ERROR, link.line, link.column);
      }
    }
  }

  /** The statement a link addresses, or nothing where no label carries one. */
  private statement(
    module: Module, node: Placed, link: Link, clause: string,
  ): Statement | null {
    const found = this.labels.get(link.label);
    if (found === undefined) {
      this.report(module, node,
        `"${clause}": no statement is labelled ${link.label}`,
        ERROR, link.line, link.column);
      return null;
    }
    const [, target] = found;
    return isStatement(target) ? target : null;
  }

  /** Whether the chain of "replaces" leads from a label back to itself. */
  private closes(label: string): boolean {
    const seen = new Set<string>();
    let front = this.replacedBy(label);
    while (front.length) {
      const next: string[] = [];
      for (const item of front) {
        if (item === label) return true;
        if (seen.has(item)) continue;
        seen.add(item);
        next.push(...this.replacedBy(item));
      }
      front = next;
    }
    return false;
  }

  private replacedBy(label: string): string[] {
    const found = this.labels.get(label);
    if (found === undefined) return [];
    const [, node] = found;
    return isStatement(node) ? node.replaces.map((link) => link.label) : [];
  }

  /**
   * The references of one text.
   *
   * A statement is checked as a whole, its `states` and its `because`
   * together: a name introduced in the one is meant in the other. The names
   * introduced are gathered first, because `[source.order-state]` can only
   * be read once it is known what `source` was introduced as.
   */
  private checkProse(
    module: Module, node: Placed, ...proses: (Prose | null)[]
  ): void {
    const references: Reference[] = [];
    for (const prose of proses) {
      if (prose !== null) references.push(...prose.references());
    }

    const declared = this.index.get(module.name);
    const bound = new Map<string, Binding>();
    const named = new Map<string, string[]>();
    for (const reference of references) {
      if (LABEL_RE.test(reference.target)) continue;
      const at = address(reference.target);
      // A name that repeats a declared one is refused below and binds
      // nothing: otherwise it would shadow what it repeats.
      if (at === null || !at.which || declared?.has(at.which)) continue;
      if (bound.has(at.which)) continue;
      bound.set(at.which, { type: at, at: reference });
      const key = this.qualified(at.module || module.name, at.name);
      named.set(key, [...(named.get(key) ?? []), at.which]);
    }

    for (const reference of references) {
      // A label is the address of a statement, not a thing a sentence
      // reaches into. Where one turns up in prose it is prose, and the tool
      // has nothing to say about it either way.
      if (LABEL_RE.test(reference.target)) continue;

      // Both sides are always written: the word of the sentence for the
      // reader, the address beside it for the reviewer.
      if (!reference.display) {
        this.report(module, node,
          `reference: "${reference.target}" carries no caption`
          + ` — write [${reference.target}|…]`,
          ERROR, reference.line, reference.column);
      }

      const at = address(reference.target);
      if (at === null) {
        this.report(module, node,
          `reference: "${reference.target}" is neither a label nor an address`,
          ERROR, reference.line, reference.column);
        continue;
      }

      if (at.which) this.checkIntroduction(module, node, at, bound, reference);
      else if (!at.module && bound.has(at.name)) {
        this.checkBoundMember(module, node, at, bound.get(at.name)!.type, reference);
      } else {
        const target = this.lookup(module, at.base, node, reference.line,
          reference.column, "reference");
        if (target === null) continue;
        this.checkMember(module, node, at, target, reference);
        this.checkNamedAlready(module, node, at, target, named, reference);
      }
    }
  }

  /**
   * `[order#source|…]` — a name for one thing of that type, held for the
   * length of this text.
   *
   * Which of two orders `source` stands for is checked against nothing: that
   * is beyond the tool, exactly as the caption is. What is held is that the
   * type is declared, that the name is written once and shadows nothing, and
   * that the type is not repeated afterwards.
   */
  private checkIntroduction(
    module: Module, node: Placed, at: Address, bound: Map<string, Binding>,
    reference: Reference,
  ): void {
    const where = [ERROR, reference.line, reference.column] as const;
    const head = at.module ? `${at.module}:${at.name}#${at.which}` : `${at.name}#${at.which}`;

    if (at.member) {
      this.report(module, node,
        `reference: the type stands where "${at.which}" is introduced`
        + ` — write [${at.which}.${at.member}|…]`, ...where);
      return;
    }
    if (this.index.get(module.name)?.has(at.which)) {
      this.report(module, node,
        `reference: "${at.which}" is declared in module "${module.name}"`
        + " — a name introduced here must not repeat it", ...where);
      return;
    }
    const first = bound.get(at.which);
    if (first !== undefined && first.at !== reference) {
      this.report(module, node,
        `reference: "${at.which}" is introduced twice — the type stands once,`
        + " afterwards the name alone", ...where);
      return;
    }

    const target = this.lookup(module, at.base, node, reference.line,
      reference.column, "reference");
    if (target === "root") {
      this.report(module, node,
        `reference: "${BUILTIN_ROOT}" is the top of the hierarchy,`
        + ` not a type to introduce "${head}" of`, ...where);
    }
  }

  /**
   * Within one text a name of a type stands for one thing of that type. So
   * once a name has been introduced for it, the type itself stands for a
   * thing no longer: `[order|order]` beside `[order#source|…]` would ask
   * which of them it is.
   *
   * A value of an enum is not a thing and is untouched by this: `placed` is
   * reached through the enum in any text.
   */
  private checkNamedAlready(
    module: Module, node: Placed, at: Address, target: Target,
    named: Map<string, string[]>, reference: Reference,
  ): void {
    if (target === null || target === "root") return;
    if (target.kind === "enum" && at.member) return;
    const names = named.get(this.qualified(at.module || module.name, at.name));
    if (names === undefined) return;
    const written = names.map((name) => `"${name}"`);
    const list = written.length === 1
      ? written[0]
      : `${written.slice(0, -1).join(", ")} or ${written[written.length - 1]}`;
    this.report(module, node,
      `reference: this text names what is of type "${at.name}"`
      + ` — write ${list} instead of the type`,
      ERROR, reference.line, reference.column);
  }

  /** `[source.order-state|…]` — a part of what the name was introduced as. */
  private checkBoundMember(
    module: Module, node: Placed, at: Address, type: Address,
    reference: Reference,
  ): void {
    if (!at.member) return;
    const found = this.resolveSilently(module, type.base);
    if (found === null) return;
    const [owner, declared] = found;
    const where = [ERROR, reference.line, reference.column] as const;

    if (declared.kind === "enum") {
      this.report(module, node,
        `reference: a value of an enum belongs to the enum, not to`
        + ` "${at.name}" — write [${type.name}.${at.member}|…]`, ...where);
      return;
    }
    if (declared.kind === "value") {
      this.report(module, node,
        `reference: "${at.name}" was introduced as "${declared.name}",`
        + " and a value has no parts", ...where);
      return;
    }
    if (!this.partsOf(owner, declared).has(at.member)) {
      this.report(module, node,
        `reference: "${at.name}" was introduced as "${declared.name}",`
        + ` which has no part "${at.member}"`, ...where);
    }
  }

  /** What stands after the "." of an address written on a declared name. */
  private checkMember(
    module: Module, node: Placed, at: Address, target: Target,
    reference: Reference,
  ): void {
    const where = [ERROR, reference.line, reference.column] as const;
    if (target === "root") {
      if (at.member) {
        this.report(module, node,
          `reference: "${BUILTIN_ROOT}" is the top of the hierarchy`
          + " and has no parts", ...where);
      }
      return;
    }
    if (!at.member) return;

    const found = this.resolveSilently(module, at.base);
    if (found === null) return;
    const [owner, declared] = found;

    if (declared.kind === "entity") {
      if (!this.partsOf(owner, declared).has(at.member)) {
        this.report(module, node,
          `reference: "${at.name}" has no part "${at.member}"`, ...where);
      }
      return;
    }
    if (declared.kind === "enum") {
      if (!declared.values.some((value) => value.name === at.member)) {
        this.report(module, node,
          `reference: enum "${at.name}" has no value "${at.member}"`, ...where);
      }
      return;
    }
    this.report(module, node,
      `reference: "${at.name}" is a value, and a value has no parts`, ...where);
  }

  private checkMeans(module: Module, node: Declaration): void {
    const means = meansOf(node);
    if (means === null) return;
    if (means.plain.trim().length < MEANS_MINIMUM) {
      this.report(module, node,
        `"means" is shorter than ${MEANS_MINIMUM} characters`
        + " — it looks like a stub",
        WARNING, means.line, means.column);
    }
    this.checkProse(module, node, means);
  }

  private checkModuleMeans(module: Module): void {
    if (module.means === null) return;
    if (module.means.plain.trim().length < MEANS_MINIMUM) {
      this.report(module, module,
        `the "means" of the module is shorter than ${MEANS_MINIMUM} characters`,
        WARNING, module.means.line, module.means.column);
    }
    this.checkProse(module, module, module.means);
  }

  /**
   * Looks for dead names — only in modules that hold requirements.
   *
   * A module without requirements is a vocabulary: its entities are
   * introduced for other specifications, and silence about them here means
   * nothing.
   */
  private checkUnused(): void {
    const mentioned = this.mentionedByRequirements();
    for (const module of this.world.modules.values()) {
      if (!module.requirements.length) continue;
      for (const node of module.named) {
        const key = this.qualified(module.name, node.name);
        if (!this.used.has(key)) {
          this.report(module, node,
            `${node.kind} "${node.name}" is mentioned nowhere`, WARNING);
        } else if (node.kind === "entity" && node.parts.length && !mentioned.has(key)) {
          this.report(module, node,
            `entity "${node.name}" has a composition, but no requirement`
            + " mentions it", WARNING);
        }
      }
    }
  }

  /**
   * Looks for assumptions nothing leans on.
   *
   * Only the labelled ones. A label is an address, and an address nobody
   * writes down is what is worth reporting; an assumption written without
   * one asks to be read along with the rest, not to be addressed.
   */
  private checkUnassumed(): void {
    for (const module of this.world.modules.values()) {
      for (const node of module.ofKind("assume")) {
        if (!node.label || this.given.has(node.label)) continue;
        this.report(module, node,
          `assumption ${node.label} underlies no statement`, WARNING);
      }
    }
  }

  private mentionedByRequirements(): Set<string> {
    const mentioned = new Set<string>();
    for (const module of this.world.modules.values()) {
      for (const node of module.declarations) {
        if (!("states" in node)) continue;
        for (const prose of [node.states, node.because]) {
          if (prose === null) continue;
          for (const reference of prose.references()) {
            if (LABEL_RE.test(reference.target)) continue;
            const at = address(reference.target);
            if (at === null) continue;
            mentioned.add(this.qualified(at.module || module.name, at.name));
          }
        }
      }
    }
    return mentioned;
  }
}

/** Ordering by code point: what a path is sorted by, not by locale. */
export function compare(one: string, other: string): number {
  if (one < other) return -1;
  return one > other ? 1 : 0;
}

/** A qualified name: what stands before the first colon, and the rest. */
function split(ref: string): [string, string] {
  const at = ref.indexOf(":");
  return [ref.slice(0, at), ref.slice(at + 1)];
}

export function resolve(world: World): Diagnostic[] {
  return new Resolver(world).check();
}
