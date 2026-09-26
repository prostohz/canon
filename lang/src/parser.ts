import { Diagnostic, SpecError } from "./errors.js";
import { Token, describe, tokenize } from "./lexer.js";
import {
  Assumption,
  Declaration,
  Entity,
  Enum,
  Exclusion,
  Link,
  Module,
  OBLIGATIONS,
  Obligation,
  Part,
  Prose,
  Requirement,
  Value,
  assumption,
  entity,
  enumeration,
  exclusion,
  requirement,
  value,
} from "./nodes.js";

const DECLARATIONS = [
  "entity", "enum", "value", "requirement", "assume", "exclude",
];

/** What may stand after the type of a part, in either order. */
const FLAGS = ["many", "optional"];

type Clauses = Requirement | Assumption | Exclusion;

class Parser {
  private readonly tokens: Token[];
  private i = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  // --- plumbing -------------------------------------------------------

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.i + ahead, this.tokens.length - 1)];
  }

  private advance(): Token {
    const found = this.tokens[this.i];
    if (found.kind !== "eof") this.i += 1;
    return found;
  }

  private at(kind: string, value = ""): boolean {
    const found = this.peek();
    return found.kind === kind && (!value || found.value === value);
  }

  private atKeyword(value: string): boolean {
    return this.at("kw", value);
  }

  private fail(expected: string): never {
    const found = this.peek();
    throw new SpecError(
      new Diagnostic(found.line, found.column,
        `expected ${expected}, found ${describe(found)}`),
    );
  }

  private eat(kind: string, expected: string, value = ""): Token {
    if (!this.at(kind, value)) this.fail(expected);
    return this.advance();
  }

  private eatKeyword(value: string): Token {
    return this.eat("kw", `"${value}"`, value);
  }

  /**
   * The name of an entity.
   *
   * A keyword is accepted wherever the grammar offers no choice: after
   * "entity", "uses", a colon and the like. Otherwise `data:value` and
   * `requirements:obligation` would be inexpressible.
   */
  private eatName(expected: string): Token {
    const found = this.peek();
    if (found.kind === "name" || found.kind === "kw") return this.advance();
    this.fail(expected);
  }

  private newline(): void {
    this.eat("newline", "end of line");
  }

  private opensBlock(): boolean {
    return this.at("indent");
  }

  private enter(): void {
    this.eat("indent", "start of block");
  }

  private leave(): void {
    this.eat("dedent", "end of block");
  }

  // --- text -----------------------------------------------------------

  private prose(keyword: string): Prose {
    this.eatKeyword(keyword);
    this.newline();
    const found = this.eat("text", `text after "${keyword}"`);
    return new Prose(found.value, found.line, found.column);
  }

  // --- parsing --------------------------------------------------------

  parse(): Module {
    const module = this.moduleDeclaration();
    while (!this.at("eof")) module.declarations.push(this.declaration());
    return module;
  }

  private moduleDeclaration(): Module {
    let head = this.eat("kw", '"language" at the start of the file', "language");
    const version = this.eat("version", "a format version of the form 0.1.0");
    this.newline();
    const found = this.eat("kw", '"module" after the format version', "module");
    const name = this.eatName("a module name");
    const module = new Module(found.line, found.column);
    module.name = name.value;
    module.language = version.value;
    module.languageLine = head.line;
    this.newline();
    if (!this.opensBlock()) return module;
    this.enter();
    while (this.atKeyword("uses")) {
      head = this.advance();
      module.usesLine = module.usesLine || head.line;
      module.uses.push(this.eatName("a module name").value);
      while (this.at(",")) {
        this.advance();
        module.uses.push(this.eatName("a module name").value);
      }
      this.newline();
    }
    if (this.atKeyword("means")) module.means = this.prose("means");
    this.leave();
    return module;
  }

  private declaration(): Declaration {
    if (this.atKeyword("entity")) return this.entityDeclaration();
    if (this.atKeyword("enum")) return this.enumDeclaration();
    if (this.atKeyword("value")) return this.valueDeclaration();
    if (this.atKeyword("requirement")) return this.requirement();
    if (this.atKeyword("assume")) return this.assumption();
    if (this.atKeyword("exclude")) return this.exclusion();
    this.fail(
      "a declaration: " + DECLARATIONS.map((word) => `"${word}"`).join(", "),
    );
  }

  // --- entity ---------------------------------------------------------

  private entityDeclaration(): Entity {
    const found = this.eatKeyword("entity");
    const name = this.eatName("an entity name");
    const node = entity(found.line, found.column, name.value);
    if (this.at(":")) {
      this.advance();
      const supertype = this.reference("a supertype");
      node.supertype = supertype.value;
      node.supertypeLine = supertype.line;
      node.supertypeColumn = supertype.column;
    }
    this.newline();
    if (!this.opensBlock()) return node;
    this.enter();
    while (!this.at("dedent")) {
      if (this.atKeyword("means")) {
        this.once(node.means, "means");
        node.means = this.prose("means");
      } else {
        node.parts.push(this.part());
      }
    }
    this.leave();
    return node;
  }

  private part(): Part {
    const name = this.eatName('a part name or "means"');
    const part = new Part(name.line, name.column, name.value);
    this.eat(":", "a colon between the name of a part and its type");
    const type = this.reference("the type of a part");
    part.type = type.value;
    part.typeLine = type.line;
    part.typeColumn = type.column;
    this.flags(part);
    this.newline();
    return part;
  }

  /**
   * How much of a part there is: `many`, `optional`, in either order and
   * each at most once. Neither of them means exactly one.
   */
  private flags(part: Part): void {
    const written = new Set<string>();
    while (this.at("kw") && FLAGS.includes(this.peek().value)) {
      const token = this.advance();
      if (written.has(token.value)) {
        throw new SpecError(new Diagnostic(token.line, token.column,
          `"${token.value}" is written twice`));
      }
      written.add(token.value);
      if (token.value === "many") part.many = true;
      else part.optional = true;
    }
  }

  // --- enumeration and value ------------------------------------------

  private enumDeclaration(): Enum {
    const found = this.eatKeyword("enum");
    const name = this.eatName("an enum name");
    const node = enumeration(found.line, found.column, name.value);
    this.newline();
    this.enter();
    while (!this.at("dedent")) {
      if (this.atKeyword("means")) {
        this.once(node.means, "means");
        node.means = this.prose("means");
      } else {
        const item = this.eatName("a value of the enum");
        node.values.push({ line: item.line, column: item.column, name: item.value });
        this.newline();
      }
    }
    this.leave();
    if (!node.values.length) {
      throw new SpecError(
        new Diagnostic(node.line, node.column, `enum "${node.name}" holds no values`),
      );
    }
    return node;
  }

  private valueDeclaration(): Value {
    const found = this.eatKeyword("value");
    const name = this.eatName("a value name");
    const node = value(found.line, found.column, name.value);
    this.eat(":", "a colon between the name of a value and its supertype");
    const supertype = this.reference("the supertype of a value");
    node.supertype = supertype.value;
    node.supertypeLine = supertype.line;
    node.supertypeColumn = supertype.column;
    this.newline();
    node.means = this.trailingMeans();
    return node;
  }

  private trailingMeans(): Prose | null {
    if (!this.opensBlock()) return null;
    this.enter();
    const means = this.prose("means");
    this.leave();
    return means;
  }

  // --- requirement and assumption ---------------------------------------

  private requirement(): Requirement {
    const found = this.eatKeyword("requirement");
    const label = this.eat("label", "a requirement label of the form R-014");
    const node = requirement(found.line, found.column, label.value);
    this.enterClauses(node);
    if (node.states === null) {
      throw new SpecError(
        new Diagnostic(node.line, node.column,
          `requirement ${node.label} without "states"`),
      );
    }
    return node;
  }

  private assumption(): Assumption {
    const found = this.eatKeyword("assume");
    const node = assumption(found.line, found.column);
    if (this.at("label")) node.label = this.advance().value;
    this.enterClauses(node);
    if (node.states === null) {
      const where = node.label ? ` ${node.label}` : "";
      throw new SpecError(
        new Diagnostic(node.line, node.column, `assumption${where} without "states"`),
      );
    }
    return node;
  }

  private exclusion(): Exclusion {
    const found = this.eatKeyword("exclude");
    const node = exclusion(found.line, found.column);
    if (this.at("label")) node.label = this.advance().value;
    this.enterClauses(node);
    if (node.states === null) {
      const where = node.label ? ` ${node.label}` : "";
      throw new SpecError(
        new Diagnostic(node.line, node.column, `exclusion${where} without "states"`),
      );
    }
    return node;
  }

  private enterClauses(node: Clauses): void {
    // How binding a statement is belongs to a requirement alone; leaning on
    // an assumption belongs to everything that is not one, or assumptions
    // would form a hierarchy of their own.
    const obligation = node.kind === "requirement";
    const given = node.kind !== "assume";

    this.newline();
    if (!this.opensBlock()) return;
    this.enter();
    let written = false;
    while (!this.at("dedent")) {
      if (this.atKeyword("states")) {
        this.once(node.states, "states");
        node.states = this.prose("states");
      } else if (this.atKeyword("because")) {
        this.once(node.because, "because");
        node.because = this.prose("because");
      } else if (this.atKeyword("replaces")) {
        this.links(node.replaces);
      } else if (given && this.atKeyword("given")) {
        this.links(node.given);
      } else if (obligation && this.atKeyword("obligation")) {
        const found = this.advance();
        if (written) {
          throw new SpecError(new Diagnostic(found.line, found.column,
            '"obligation" is written at most once'));
        }
        written = true;
        (node as Requirement).obligation = this.obligation();
        this.newline();
      } else {
        const clauses = ['"states"', '"because"', '"replaces"'];
        if (given) clauses.push('"given"');
        if (obligation) clauses.push('"obligation"');
        this.fail(clauses.join(", "));
      }
    }
    this.leave();
  }

  /**
   * The labels of a link, written like the modules of "uses": a list on the
   * line, and as many lines as are wanted.
   *
   * Several are the ordinary case rather than an indulgence — two statements
   * merged into one replace two labels, and one split into two is written on
   * the two that replace it.
   */
  private links(into: Link[]): void {
    this.advance();
    for (;;) {
      const found = this.eat("label", "a label of the form R-014");
      into.push({ label: found.value, line: found.line, column: found.column });
      if (!this.at(",")) break;
      this.advance();
    }
    this.newline();
  }

  /**
   * The two words an obligation is written with. The set is closed: a scale
   * of one's own would be a word nobody answers for.
   */
  private obligation(): Obligation {
    const found = this.eatName('"mandatory" or "recommended"');
    if (!(OBLIGATIONS as readonly string[]).includes(found.value)) {
      throw new SpecError(new Diagnostic(found.line, found.column,
        `"${found.value}" is not an obligation: "mandatory" or "recommended"`));
    }
    return found.value as Obligation;
  }

  private once(current: Prose | null, keyword: string): void {
    if (current !== null) {
      const found = this.peek();
      throw new SpecError(
        new Diagnostic(found.line, found.column, `"${keyword}" is written at most once`),
      );
    }
  }

  // --- names ----------------------------------------------------------

  private reference(expected: string): Token {
    const found = this.peek();
    if (["qname", "name", "kw"].includes(found.kind)) return this.advance();
    this.fail(expected);
  }
}

export function parse(source: string): Module {
  return new Parser(source).parse();
}
