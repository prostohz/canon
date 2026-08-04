/** The set of specifications, shaped for display. */
import {
  BUILTIN_ROOT,
  Diagnostic,
  ERROR,
  LABEL_RE,
  Module,
  Part,
  Prose,
  World,
  address,
  isStatement,
  replaced,
} from "@canon/lang";
import type { Declaration, Entity, Named } from "@canon/lang";

const KINDS: Record<Declaration["kind"], string> = {
  entity: "entity",
  enum: "enum",
  value: "value",
  requirement: "requirement",
  assume: "assumption",
  exclude: "exclusion",
};

export interface ProseView {
  text: string;
  references: { target: string; display: string }[];
}

export interface PartView {
  name: string;
  type: string;
  /** The words written after the type: `many`, `optional`, or neither. */
  amount: string;
  inherited: string;
  line: number;
}

export interface MentionView {
  module: string;
  name: string;
  kind: string;
}

export interface ProblemView {
  line: number;
  column: number;
  message: string;
  severity: string;
}

export interface DeclarationView {
  kind: string;
  kindName: string;
  name: string;
  line: number;
  means: ProseView | null;
  states: ProseView | null;
  because: ProseView | null;
  obligation: string;
  supertype?: string;
  parts?: PartView[];
  inherited?: PartView[];
  ancestors?: string[];
  values?: string[];
  mentions?: MentionView[];
  /** The labels this statement replaces, and those it leans upon. */
  replaces?: string[];
  given?: string[];
  /**
   * The other end of each link, which the text of a file does not hold: what
   * replaced this statement, and what leans upon it.
   */
  replacedBy?: string[];
  underlies?: string[];
  /** Whether the statement still stands: false once something replaces it. */
  inForce?: boolean;
}

export interface ModuleView {
  name: string;
  language: string;
  path: string;
  uses: string[];
  means: ProseView | null;
  declarations: DeclarationView[];
  problems: ProblemView[];
}

export interface Totals {
  modules: number;
  named: number;
  requirements: number;
  exclusions: number;
  /** Statements something replaces: counted among the set, out of force. */
  replaced: number;
  errors: number;
  warnings: number;
}

export interface WorldView {
  modules: ModuleView[];
  totals: Totals;
}

function qualified(moduleName: string, name: string): string {
  return `${moduleName}:${name}`;
}

function find(world: World, ref: string, home: string): [Module, Named] | null {
  const at = ref.indexOf(":");
  const [moduleName, name] = at === -1
    ? [home, ref]
    : [ref.slice(0, at), ref.slice(at + 1)];
  const module = world.modules.get(moduleName);
  if (module === undefined) return null;
  for (const node of module.named) {
    if (node.name === name) return [module, node];
  }
  return null;
}

/** The chain of supertypes, nearest one first. */
function chain(world: World, module: Module, entity: Entity): [Module, Named][] {
  const walked: [Module, Named][] = [];
  const seen = new Set<string>();
  let currentModule = module;
  let current: Named = entity;
  while (current.kind === "entity" && current.supertype) {
    if (current.supertype === BUILTIN_ROOT) break;
    const found = find(world, current.supertype, currentModule.name);
    if (found === null) break;
    const [owner, node] = found;
    if (seen.has(qualified(owner.name, node.name))) break;
    seen.add(qualified(owner.name, node.name));
    walked.push([owner, node]);
    currentModule = owner;
    current = node;
  }
  return walked;
}

function partRow(part: Part, owner = ""): PartView {
  return {
    name: part.name,
    type: part.type,
    amount: part.flags().join(" "),
    inherited: owner,
    line: part.line,
  };
}

function prose(block: Prose | null): ProseView | null {
  if (block === null) return null;
  return {
    text: block.text,
    references: block.references().map((reference) => ({
      target: reference.target,
      display: reference.display,
    })),
  };
}

function nameOf(node: Declaration): string {
  if ("name" in node) return node.name;
  return node.label || KINDS[node.kind];
}

function referencesOf(node: Declaration): string[] {
  const blocks: (Prose | null)[] = [
    "states" in node ? node.states : null,
    "because" in node ? node.because : null,
    "means" in node ? node.means : null,
  ];
  return blocks.flatMap((block) =>
    block === null ? [] : block.references().map((reference) => reference.target));
}

function under(index: Map<string, string[]>, key: string, value: string): void {
  index.set(key, [...(index.get(key) ?? []), value]);
}

export function build(world: World, diagnostics: Diagnostic[]): WorldView {
  const mentions = new Map<string, MentionView[]>();

  // A link is written on the statement that came second and names the one
  // that was already there, so the other end of it is nowhere in the text.
  // Here is the one place both ends are visible.
  const retired = replaced(world);
  const replacedBy = new Map<string, string[]>();
  const underlies = new Map<string, string[]>();
  for (const [, node] of world.declarations()) {
    if (!isStatement(node)) continue;
    const from = nameOf(node);
    for (const link of node.replaces) under(replacedBy, link.label, from);
    for (const link of node.given) under(underlies, link.label, from);
  }

  for (const module of world.modules.values()) {
    for (const node of module.declarations) {
      // A part and a value of an enum are shown under the declaration
      // holding them, and a name mentioned twice mentions it once.
      const keys = new Set<string>();
      for (const target of referencesOf(node)) {
        if (LABEL_RE.test(target)) continue;
        const at = address(target);
        if (at === null) continue;
        keys.add(qualified(at.module || module.name, at.name));
      }
      for (const key of keys) {
        const found = mentions.get(key) ?? [];
        found.push({ module: module.name, name: nameOf(node), kind: node.kind });
        mentions.set(key, found);
      }
    }
  }

  const problems = new Map<string, ProblemView[]>();
  for (const diagnostic of diagnostics) {
    const found = problems.get(diagnostic.path) ?? [];
    found.push({
      line: diagnostic.line,
      column: diagnostic.column,
      message: diagnostic.message,
      severity: diagnostic.severity,
    });
    problems.set(diagnostic.path, found);
  }

  const modules: ModuleView[] = [];
  for (const name of [...world.modules.keys()].sort()) {
    const module = world.modules.get(name)!;
    const declarations: DeclarationView[] = [];

    for (const node of module.declarations) {
      const row: DeclarationView = {
        kind: node.kind,
        kindName: KINDS[node.kind],
        name: nameOf(node),
        line: node.line,
        means: prose("means" in node ? node.means : null),
        states: prose("states" in node ? node.states : null),
        because: prose("because" in node ? node.because : null),
        obligation: node.kind === "requirement" ? node.obligation : "",
      };

      if (node.kind === "entity") {
        row.supertype = node.supertype;
        row.parts = node.parts.map((part) => partRow(part));
        const inherited: PartView[] = [];
        const own = new Set(node.parts.map((part) => part.name));
        const ancestors = chain(world, module, node);
        for (const [owner, ancestor] of ancestors) {
          if (ancestor.kind !== "entity") continue;
          for (const part of ancestor.parts) {
            if (own.has(part.name)) continue;
            own.add(part.name);
            inherited.push(partRow(part, qualified(owner.name, ancestor.name)));
          }
        }
        row.inherited = inherited;
        row.ancestors = ancestors.map(([owner, ancestor]) =>
          qualified(owner.name, ancestor.name));
      } else if (node.kind === "enum") {
        row.values = node.values.map((value) => value.name);
      } else if (node.kind === "value") {
        row.supertype = node.supertype;
      }

      if (node.kind === "entity" || node.kind === "enum" || node.kind === "value") {
        row.mentions = mentions.get(qualified(name, node.name)) ?? [];
      } else if (isStatement(node)) {
        row.replaces = node.replaces.map((link) => link.label);
        row.given = node.given.map((link) => link.label);
        row.replacedBy = node.label ? replacedBy.get(node.label) ?? [] : [];
        row.underlies = node.label ? underlies.get(node.label) ?? [] : [];
        row.inForce = !(node.label && retired.has(node.label));
      }

      declarations.push(row);
    }

    modules.push({
      name,
      language: module.language,
      path: module.path,
      uses: module.uses,
      means: prose(module.means),
      declarations,
      problems: problems.get(module.path) ?? [],
    });
  }

  const all = [...world.modules.values()];
  const totals: Totals = {
    modules: modules.length,
    named: all.reduce((sum, module) => sum + module.named.length, 0),
    requirements: all.reduce((sum, module) => sum + module.requirements.length, 0),
    exclusions: all.reduce((sum, module) => sum + module.ofKind("exclude").length, 0),
    replaced: all.reduce((sum, module) => sum + module.statements.filter(
      (node) => node.label && retired.has(node.label)).length, 0),
    errors: diagnostics.filter((item) => item.severity === ERROR).length,
    warnings: diagnostics.filter((item) => item.severity !== ERROR).length,
  };

  return { modules, totals };
}
