export const BUILTIN_ROOT = "thing";

// A reference in a text block: [name], [module:name], [name|caption], [R-014].
export const REFERENCE_RE = /(?<!\\)\[([^\[\]|]+?)(?:\|([^\[\]]*))?\]/g;

const SEGMENT = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const ADDRESS_RE = new RegExp(
  `^(?:(${SEGMENT}):)?(${SEGMENT})(?:#(${SEGMENT}))?(?:\\.(${SEGMENT}))?$`,
);

export interface Reference {
  readonly target: string;
  readonly display: string;
  readonly line: number;
  readonly column: number;
}

/**
 * The left side of a reference, taken apart: which module, which declared
 * name, which one of several things of that name the sentence means, and
 * which part of it or value of it.
 *
 * `base` is what resolves as a declared name; the rest is what is checked
 * against the declaration once it is found.
 */
export interface Address {
  readonly base: string;
  readonly module: string;
  readonly name: string;
  readonly which: string;
  readonly member: string;
}

/** Takes a reference target apart, or returns null if it is not an address. */
export function address(target: string): Address | null {
  const match = ADDRESS_RE.exec(target);
  if (match === null) return null;
  const [, module = "", name, which = "", member = ""] = match;
  return {
    base: module ? `${module}:${name}` : name, module, name, which, member,
  };
}

export class Prose {
  constructor(
    readonly text = "",
    readonly line = 0,
    readonly column = 1,
  ) {}

  references(): Reference[] {
    const found: Reference[] = [];
    for (const match of this.text.matchAll(REFERENCE_RE)) {
      const before = this.text.slice(0, match.index);
      const row = before.split("\n").length - 1;
      const column = match.index - (before.lastIndexOf("\n") + 1);
      found.push({
        target: match[1].trim(),
        display: (match[2] ?? "").trim(),
        line: this.line + row,
        column: this.column + column,
      });
    }
    return found;
  }

  get plain(): string {
    return this.text.replace(
      REFERENCE_RE,
      (_whole, target: string, display?: string) => (display || target).trim(),
    );
  }
}

/**
 * A part of a record: what it is called, what it holds, and in what shape.
 *
 * Two questions, independent of one another. `many` says the part holds a
 * collection rather than one thing; `optional` says the part may be missing
 * altogether. Neither written is one thing, present — the commonest case and
 * the strictest, and the one that costs no word.
 *
 * How many are in a collection is not asked here: a bound on the size of one
 * is an obligation on what the part holds, and those are prose.
 */
export class Part {
  name = "";
  type = "";
  many = false;
  optional = false;
  typeLine = 0;
  typeColumn = 0;

  constructor(readonly line = 0, readonly column = 0, name = "") {
    this.name = name;
  }

  /** The words written after the type, in the order they are written. */
  flags(): string[] {
    const written: string[] = [];
    if (this.many) written.push("many");
    if (this.optional) written.push("optional");
    return written;
  }
}

interface Placed {
  readonly line: number;
  readonly column: number;
}

export interface Entity extends Placed {
  kind: "entity";
  name: string;
  supertype: string;
  supertypeLine: number;
  supertypeColumn: number;
  parts: Part[];
  means: Prose | null;
}

export interface EnumValue extends Placed {
  name: string;
}

export interface Enum extends Placed {
  kind: "enum";
  name: string;
  values: EnumValue[];
  means: Prose | null;
}

export interface Value extends Placed {
  kind: "value";
  name: string;
  supertype: string;
  supertypeLine: number;
  supertypeColumn: number;
  means: Prose | null;
}

/**
 * How binding a requirement is: conformance is impossible without meeting a
 * `mandatory` one, and a `recommended` one may be departed from where the
 * departure is justified.
 */
export type Obligation = "mandatory" | "recommended";

export const OBLIGATIONS: readonly Obligation[] = ["mandatory", "recommended"];

/** What a requirement is taken to be when it says nothing: the stricter one. */
export const DEFAULT_OBLIGATION: Obligation = "mandatory";

/**
 * A statement addressed from another statement, by its label.
 *
 * The label is the address of a statement, and a sentence has no way to reach
 * one: what holds between two statements is written as a clause of the
 * declaration, not inside the prose. Which is why a label in a text stays a
 * word of that text and is passed by.
 */
export interface Link extends Placed {
  readonly label: string;
}

export const LINKS = ["replaces", "given"] as const;

export type LinkKind = (typeof LINKS)[number];

export interface Requirement extends Placed {
  kind: "requirement";
  label: string;
  states: Prose | null;
  because: Prose | null;
  obligation: Obligation;
  replaces: Link[];
  given: Link[];
}

export interface Assumption extends Placed {
  kind: "assume";
  label: string;
  states: Prose | null;
  because: Prose | null;
  replaces: Link[];
  given: Link[];
}

export interface Exclusion extends Placed {
  kind: "exclude";
  label: string;
  states: Prose | null;
  because: Prose | null;
  replaces: Link[];
  given: Link[];
}

/** What a module declares: a name, or something stated about the world. */
export type Declaration =
  | Entity
  | Enum
  | Value
  | Requirement
  | Assumption
  | Exclusion;

export type Named = Entity | Enum | Value;
export type Statement = Requirement | Assumption | Exclusion;

export const NAMED_KINDS = ["entity", "enum", "value"] as const;
export const STATEMENT_KINDS = ["requirement", "assume", "exclude"] as const;

export function isNamed(node: Declaration): node is Named {
  return (NAMED_KINDS as readonly string[]).includes(node.kind);
}

export function isStatement(node: Declaration): node is Statement {
  return (STATEMENT_KINDS as readonly string[]).includes(node.kind);
}

export function entity(line: number, column: number, name: string): Entity {
  return {
    kind: "entity", line, column, name, supertype: "", supertypeLine: 0,
    supertypeColumn: 0, parts: [], means: null,
  };
}

export function enumeration(line: number, column: number, name: string): Enum {
  return { kind: "enum", line, column, name, values: [], means: null };
}

export function value(line: number, column: number, name: string): Value {
  return {
    kind: "value", line, column, name, supertype: "", supertypeLine: 0,
    supertypeColumn: 0, means: null,
  };
}

export function requirement(line: number, column: number, label: string): Requirement {
  return {
    kind: "requirement", line, column, label, states: null, because: null,
    obligation: DEFAULT_OBLIGATION, replaces: [], given: [],
  };
}

export function assumption(line: number, column: number): Assumption {
  return {
    kind: "assume", line, column, label: "", states: null, because: null,
    replaces: [], given: [],
  };
}

export function exclusion(line: number, column: number): Exclusion {
  return {
    kind: "exclude", line, column, label: "", states: null, because: null,
    replaces: [], given: [],
  };
}

export class Module {
  name = "";
  language = "";
  languageLine = 0;
  uses: string[] = [];
  usesLine = 0;
  means: Prose | null = null;
  declarations: Declaration[] = [];
  path = "";

  constructor(readonly line = 0, readonly column = 0) {}

  ofKind<K extends Declaration["kind"]>(
    kind: K,
  ): Extract<Declaration, { kind: K }>[] {
    return this.declarations.filter(
      (node): node is Extract<Declaration, { kind: K }> => node.kind === kind,
    );
  }

  get named(): Named[] {
    return this.declarations.filter(isNamed);
  }

  get requirements(): Requirement[] {
    return this.ofKind("requirement");
  }

  get statements(): Statement[] {
    return this.declarations.filter(isStatement);
  }
}
