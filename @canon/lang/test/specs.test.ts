import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { Diagnostic, ERROR, WARNING } from "../src/errors.js";
import { KEYWORDS, tokenize } from "../src/lexer.js";
import { ManifestError, discover, read } from "../src/manifest.js";
import {
  Declaration, Entity, Enum, Module, Requirement, Value, address,
} from "../src/nodes.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/resolver.js";
import { World, load, replaced } from "../src/world.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, "..", "..");
const ROOT = join(PACKAGE, "..");
const STDLIB = join(PACKAGE, "stdlib");
const EXAMPLES = join(PACKAGE, "examples");
const PROFILE = join(PACKAGE, "test", "profile");
const GRAMMAR = join(PACKAGE, "docs", "grammar.ebnf");
const LANGUAGE = join(PACKAGE, "docs", "language.md");
const TMLANGUAGE = join(ROOT, "vscode", "syntaxes", "canon.tmLanguage.json");

const HEADER = "language 0.1.0\nmodule probe\n";

function check(source: string, extra: Record<string, string> = {}): Diagnostic[] {
  const world = new World();
  for (const [name, text] of Object.entries(extra)) {
    const module = parse(text);
    module.path = `${name}.canon`;
    world.modules.set(name, module);
  }
  const module = parse(source);
  module.path = "probe.canon";
  world.modules.set(module.name, module);
  return resolve(world);
}

function errors(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((item) => item.severity === ERROR);
}

function messages(diagnostics: Diagnostic[]): string {
  return diagnostics.map((item) => item.message).join(" | ");
}

function temporary(): string {
  return mkdtempSync(join(realpathSync(tmpdir()), "canon-"));
}

function manifest(root: string, content: string): string {
  const directory = join(root, ".canon");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "canon.toml");
  writeFileSync(path, content);
  return path;
}

function read_(path: string): string {
  return readFileSync(path, "utf8");
}

function declaration(module: Module, index = 0): Declaration {
  return module.declarations[index];
}

function entityOf(source: string, index = 0): Entity {
  const node = declaration(parse(source), index);
  assert.equal(node.kind, "entity");
  return node as Entity;
}

// --- lexer ---------------------------------------------------------------

test("indent and dedent", () => {
  const kinds = tokenize("module probe\n  uses data\n").map((item) => item.kind);
  assert.equal(kinds.filter((kind) => kind === "indent").length, 1);
  assert.equal(kinds.filter((kind) => kind === "dedent").length, 1);
});

test("a comment and blank lines are ignored", () => {
  const kinds = tokenize("# a note\n\nmodule probe\n").map((item) => item.kind);
  assert.equal(kinds[0], "kw");
});

test("a text block keeps paragraphs", () => {
  const tokens = tokenize("module probe\n  means\n    first\n\n    second\n");
  const text = tokens.filter((item) => item.kind === "text")[0];
  assert.equal(text.value, "first\n\nsecond");
});

test("a text block needs a deeper indent", () => {
  assert.throws(() => tokenize("module probe\n  means\n  flush\n"),
    /deeper indentation/);
});

test("a keyword with a tail does not open text", () => {
  const tokens = tokenize("entity probe\n  states : thing\n");
  assert.equal(tokens.filter((item) => item.kind === "text").length, 0);
});

test("a tab indent is rejected", () => {
  assert.throws(() => tokenize("module probe\n\tuses data\n"), /not a tab/);
});

test("a broken indent is rejected", () => {
  assert.throws(() => tokenize("module probe\n    uses data\n  uses core\n"),
    /matches none of the open blocks/);
});

// --- parsing -------------------------------------------------------------

test("the language version is required", () => {
  assert.throws(() => parse("module probe\n"),
    /"language" at the start of the file/);
});

test("a wrong language version stops the file", () => {
  const root = temporary();
  writeFileSync(join(root, "probe.canon"), "language 0.0.1\nmodule probe\n");
  assert.match(messages(load([root]).diagnostics), /the tool understands/);
});

test("uses may repeat", () => {
  const module = parse(HEADER + "  uses data\n  uses core\n");
  assert.deepEqual(module.uses, ["data", "core"]);
});

test("a module without a body", () => {
  assert.equal(parse(HEADER).name, "probe");
});

test("a module name must follow", () => {
  assert.throws(() => parse("language 0.1.0\nmodule\n"), /a module name/);
});

test("an entity with parts and means", () => {
  const entity = entityOf(
    HEADER
    + "entity order : thing\n"
    + "  number : text\n"
    + "  items  : thing many\n"
    + "  means\n"
    + "    An order.\n",
  );
  assert.deepEqual(entity.parts.map((part) => part.name), ["number", "items"]);
  assert.equal(entity.means?.text, "An order.");
});

for (const [written, many, optional] of [
  ["", false, false], ["optional", false, true],
  ["many", true, false], ["many optional", true, true],
] as [string, boolean, boolean][]) {
  test(`shape: ${written || "nothing written"}`, () => {
    const entity = entityOf(HEADER + `entity a : thing\n  p : text ${written}\n`);
    const part = entity.parts[0];
    assert.deepEqual([part.many, part.optional], [many, optional]);
    assert.equal(part.flags().join(" "), written);
  });
}

test("the two words are written in either order", () => {
  const entity = entityOf(HEADER + "entity a : thing\n  p : text optional many\n");
  const part = entity.parts[0];
  assert.ok(part.many && part.optional);
});

test("a word written twice is rejected", () => {
  assert.throws(() => parse(HEADER + "entity a : thing\n  p : text many many\n"),
    /"many" is written twice/);
});

for (const written of ["1", "?", "*", "+", "[2..5]", "ordered", "distinct"]) {
  test(`no longer a language: ${written}`, () => {
    assert.throws(() =>
      parse(HEADER + `entity a : thing\n  p : text ${written}\n`));
  });
}

test("the values of an enum", () => {
  const node = declaration(parse(HEADER + "enum state\n  draft\n  placed\n")) as Enum;
  assert.deepEqual(node.values.map((value) => value.name), ["draft", "placed"]);
});

test("an enum without values is rejected", () => {
  assert.throws(() => parse(HEADER + "enum state\n  means\n    Empty.\n"),
    /holds no values/);
});

test("a value refines a value", () => {
  const module = parse(
    HEADER
    + "value number : thing\n"
    + "value natural-number : number\n"
    + "value second : natural-number\n",
  );
  const chain = module.declarations.map(
    (node) => [(node as Value).name, (node as Value).supertype]);
  assert.deepEqual(chain, [
    ["number", "thing"],
    ["natural-number", "number"],
    ["second", "natural-number"],
  ]);
});

test("the clauses of a requirement come in any order", () => {
  const node = declaration(parse(
    HEADER
    + "requirement R-001\n"
    + "  obligation recommended\n"
    + "  because\n    A reason.\n"
    + "  states\n    A requirement.\n",
  )) as Requirement;
  assert.equal(node.states?.text, "A requirement.");
  assert.equal(node.because?.text, "A reason.");
  assert.equal(node.obligation, "recommended");
});

test("a requirement that says nothing is mandatory", () => {
  const node = declaration(parse(
    HEADER + "requirement R-001\n  states\n    A requirement.\n",
  )) as Requirement;
  assert.equal(node.obligation, "mandatory");
});

test("an obligation of its own is rejected", () => {
  assert.throws(() =>
    parse(HEADER
      + "requirement R-001\n  states\n    A requirement.\n  obligation high\n"),
  /"high" is not an obligation/);
});

test("an obligation is written at most once", () => {
  assert.throws(() =>
    parse(HEADER
      + "requirement R-001\n  states\n    A requirement.\n"
      + "  obligation mandatory\n  obligation recommended\n"),
  /"obligation" is written at most once/);
});

test("an obligation belongs to a requirement alone", () => {
  assert.throws(() =>
    parse(HEADER + "assume A-001\n  states\n    The environment.\n"
      + "  obligation mandatory\n"),
  /expected "states", "because"/);
});

test("a requirement without states is rejected", () => {
  assert.throws(() =>
    parse(HEADER + "requirement R-001\n  because\n    A reason.\n"),
  /without "states"/);
});

test("a clause written twice is rejected", () => {
  assert.throws(() =>
    parse(HEADER + "requirement R-001\n  states\n    One.\n  states\n    Two.\n"),
  /is written at most once/);
});

test("the label of an assumption is optional", () => {
  const node = declaration(parse(HEADER + "assume\n  states\n    The environment.\n"));
  assert.equal("label" in node ? node.label : "missing", "");
});

test("an exclusion is parsed", () => {
  const node = declaration(parse(
    HEADER
    + "exclude X-001\n"
    + "  states\n    A personal account is not included.\n"
    + "  because\n    Registration is not required.\n",
  ));
  assert.equal(node.kind, "exclude");
  assert.equal("label" in node ? node.label : "", "X-001");
  assert.equal("states" in node ? node.states?.text : "",
    "A personal account is not included.");
});

test("the label of an exclusion is optional", () => {
  const node = declaration(parse(HEADER + "exclude\n  states\n    A refusal.\n"));
  assert.equal("label" in node ? node.label : "missing", "");
});

test("an exclusion without states is rejected", () => {
  assert.throws(() =>
    parse(HEADER + "exclude X-001\n  because\n    A reason.\n"),
  /exclusion X-001 without "states"/);
});

test("an exclusion is not a requirement", () => {
  const module = parse(
    HEADER
    + "requirement R-001\n  states\n    A requirement.\n"
    + "exclude X-001\n  states\n    A refusal.\n",
  );
  assert.deepEqual(module.requirements.map((node) => node.label), ["R-001"]);
  assert.deepEqual(module.ofKind("exclude").map((node) => node.label), ["X-001"]);
  assert.equal(module.statements.length, 2);
});

// --- links ---------------------------------------------------------------

function statementOf(source: string, index = 0): Requirement {
  return declaration(parse(source), index) as Requirement;
}

function worldOf(source: string): World {
  const world = new World();
  const module = parse(source);
  module.path = "probe.canon";
  world.modules.set(module.name, module);
  return world;
}

test("the links of a statement are parsed", () => {
  const node = statementOf(
    HEADER
    + "requirement R-031\n"
    + "  replaces R-014\n"
    + "  given A-003\n"
    + "  states\n    One.\n",
  );
  assert.deepEqual(node.replaces.map((link) => link.label), ["R-014"]);
  assert.deepEqual(node.given.map((link) => link.label), ["A-003"]);
});

test("a link takes a list and repeats on as many lines as are wanted", () => {
  const node = statementOf(
    HEADER
    + "requirement R-031\n"
    + "  replaces R-014, R-020\n"
    + "  replaces R-021\n"
    + "  states\n    One.\n",
  );
  assert.deepEqual(node.replaces.map((link) => link.label),
    ["R-014", "R-020", "R-021"]);
});

test("a link carries the place of every label", () => {
  const [first, second] = statementOf(
    HEADER + "requirement R-031\n  replaces R-014, R-020\n  states\n    One.\n",
  ).replaces;
  assert.deepEqual([first.line, first.column], [4, 12]);
  assert.deepEqual([second.line, second.column], [4, 19]);
});

test("an assumption and an exclusion are replaced like anything else", () => {
  const module = parse(
    HEADER
    + "assume A-002\n  replaces A-001\n  states\n    The environment.\n"
    + "exclude X-002\n  replaces X-001\n  states\n    A refusal.\n",
  );
  assert.deepEqual(
    module.statements.map((node) => node.replaces.map((link) => link.label)),
    [["A-001"], ["X-001"]]);
});

test("an assumption carries no \"given\"", () => {
  assert.throws(() =>
    parse(HEADER + "assume A-002\n  given A-001\n  states\n    One.\n"),
  /expected "states", "because", "replaces"/);
});

test("an exclusion carries \"given\" and no obligation", () => {
  const node = statementOf(
    HEADER + "exclude X-001\n  given A-001\n  states\n    A refusal.\n");
  assert.deepEqual(node.given.map((link) => link.label), ["A-001"]);
  assert.throws(() =>
    parse(HEADER + "exclude X-001\n  obligation mandatory\n  states\n    One.\n"),
  /expected "states", "because", "replaces", "given"/);
});

test("a link without a label is rejected", () => {
  assert.throws(() =>
    parse(HEADER + "requirement R-031\n  replaces\n  states\n    One.\n"),
  /a label of the form R-014/);
});

test("a link to a label nobody carries is an error", () => {
  const source = HEADER
    + "requirement R-031\n  replaces R-999\n  states\n    One.\n"
    + "  because\n    A reason for it.\n";
  assert.match(messages(errors(check(source))),
    /"replaces": no statement is labelled R-999/);
});

test("a statement replacing itself is an error", () => {
  const source = HEADER
    + "requirement R-001\n  replaces R-001\n  states\n    One.\n"
    + "  because\n    A reason for it.\n";
  assert.match(messages(errors(check(source))),
    /"replaces": R-001 replaces itself/);
});

test("a chain of replaces that closes is an error", () => {
  const source = HEADER
    + "requirement R-001\n  replaces R-002\n  states\n    One.\n"
    + "  because\n    A reason for it.\n"
    + "requirement R-002\n  replaces R-001\n  states\n    Two.\n"
    + "  because\n    A reason for it.\n";
  assert.match(messages(errors(check(source))),
    /the chain of "replaces" closes on R-001/);
});

test("a chain of replaces that does not close is accepted", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    An [order|order].\n"
    + "  because\n    A reason for it.\n"
    + "requirement R-002\n  replaces R-001\n  states\n    An [order|order].\n"
    + "  because\n    A reason for it.\n"
    + "requirement R-003\n  replaces R-002\n  states\n    An [order|order].\n"
    + "  because\n    A reason for it.\n";
  assert.deepEqual(errors(check(source)), []);
});

test("a requirement replaces an exclusion, and that is how a refusal is reversed", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "exclude X-101\n  states\n    Refunding an [order|order] is out.\n"
    + "  because\n    It needs reconciliation with the provider.\n"
    + "requirement R-050\n  replaces X-101\n"
    + "  states\n    An [order|order] is refundable.\n"
    + "  because\n    The reconciliation is in place now.\n";
  assert.deepEqual(errors(check(source)), []);
  assert.deepEqual([...replaced(worldOf(source))], ["X-101"]);
});

test("a label is global, so a link crosses a module", () => {
  const other = "language 0.1.0\nmodule other\n"
    + "requirement R-001\n  states\n    One.\n  because\n    A reason for it.\n";
  const source = HEADER
    + "requirement R-002\n  replaces R-001\n  states\n    Two.\n"
    + "  because\n    A reason for it.\n";
  assert.deepEqual(errors(check(source, { other })), []);
});

test("what \"given\" names must be an assumption", () => {
  const source = HEADER
    + "requirement R-001\n  states\n    One.\n  because\n    A reason for it.\n"
    + "requirement R-002\n  given R-001\n  states\n    Two.\n"
    + "  because\n    A reason for it.\n";
  assert.match(messages(errors(check(source))),
    /"given": R-001 is a requirement, not an assumption/);
});

test("a labelled assumption that underlies nothing warns", () => {
  const source = HEADER
    + "assume A-001\n  states\n    The environment holds.\n";
  assert.match(messages(warningsOf(source)),
    /assumption A-001 underlies no statement/);
});

test("an assumption leant upon does not warn", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "assume A-001\n  states\n    Every [order|order] carries a customer.\n"
    + "requirement R-001\n  given A-001\n  states\n    An [order|order].\n"
    + "  because\n    A reason for it.\n";
  assert.doesNotMatch(messages(warningsOf(source)), /underlies no statement/);
});

test("an unlabelled assumption asks to be read, not to be addressed", () => {
  const source = HEADER + "assume\n  states\n    The environment holds.\n";
  assert.doesNotMatch(messages(warningsOf(source)), /underlies no statement/);
});

test("a replaced statement is out of force and still checked", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    An [order.nowhere|order].\n"
    + "  because\n    A reason for it.\n"
    + "requirement R-002\n  replaces R-001\n  states\n    An [order|order].\n"
    + "  because\n    A reason for it.\n";
  assert.deepEqual([...replaced(worldOf(source))], ["R-001"]);
  assert.match(messages(errors(check(source))), /"order" has no part "nowhere"/);
});

test("a keyword is accepted as a name", () => {
  const entity = entityOf(HEADER + "entity value : thing\n  obligation : text\n");
  assert.equal(entity.name, "value");
  assert.equal(entity.parts[0].name, "obligation");
});

test("the words of an obligation are reserved nowhere", () => {
  const module = parse(HEADER + "enum grade\n  mandatory\n  recommended\n");
  const node = declaration(module) as Enum;
  assert.deepEqual(node.values.map((item) => item.name),
    ["mandatory", "recommended"]);
});

// --- references ----------------------------------------------------------

test("references are found with their position", () => {
  const module = parse(
    HEADER
    + "entity order : thing\n"
    + "requirement R-001\n"
    + "  states\n"
    + "    The first line.\n"
    + "    Then [order|order] and [R-001].\n",
  );
  const states = (declaration(module, 1) as Requirement).states!;
  const found = states.references();
  assert.deepEqual(found.map((reference) => reference.target), ["order", "R-001"]);
  assert.equal(found[0].display, "order");
  assert.equal(found[0].line, states.line + 1);
});

test("an escaped bracket is not a reference", () => {
  const module = parse(
    HEADER + "requirement R-001\n  states\n    A bracket \\[not a reference].\n");
  assert.deepEqual((declaration(module) as Requirement).states!.references(), []);
});

test("a reference may span a line break", () => {
  const module = parse(
    HEADER
    + "entity order : thing\n"
    + "requirement R-001\n"
    + "  states\n"
    + "    Given an [order|very long\n"
    + "    name of an order].\n",
  );
  const found = (declaration(module, 1) as Requirement).states!.references();
  assert.deepEqual(found.map((reference) => reference.target), ["order"]);
  assert.equal(found[0].display, "very long\nname of an order");
});

test("an empty display falls back to the target", () => {
  const module = parse(HEADER + "requirement R-001\n  states\n    Given [order|].\n");
  assert.equal((declaration(module) as Requirement).states!.plain, "Given order.");
});

test("an own name may be qualified", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    Given [probe:order|an order].\n"
    + "  because\n    A reason.\n";
  assert.deepEqual(errors(check(source)), []);
});

test("a part is not addressable on its own", () => {
  const source = HEADER
    + "value amount : thing\n"
    + "entity order : thing\n  total : amount\n"
    + "requirement R-001\n  states\n    Given [total|the total].\n";
  assert.match(messages(errors(check(source))), /"total" is not declared/);
});

test("a value of an enum is not addressable on its own", () => {
  const source = HEADER
    + "enum state\n  draft\n"
    + "requirement R-001\n  states\n    Given [draft|a draft].\n";
  assert.match(messages(errors(check(source))), /"draft" is not declared/);
});

test("an address without a caption", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    Given [order].\n";
  assert.match(messages(errors(check(source))),
    /"order" carries no caption — write \[order\|…\]/);
});

test("an empty caption is no caption", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    Given [order| ].\n";
  assert.match(messages(errors(check(source))), /carries no caption/);
});

test("a label in prose is prose, wherever it stands", () => {
  const source = HEADER
    + "entity order : thing\n  means\n"
    + "    order: what a customer asked for, as [R-001|the first rule] has it.\n"
    + "requirement R-001\n  states\n    About an [order|order].\n"
    + "  because\n    A reason, as in [X-001].\n"
    + "exclude X-001\n  states\n    A refusal.\n  because\n    A reason.\n";
  assert.deepEqual(errors(check(source)), []);
});

test("a requirement that names only labels refers to no entity", () => {
  const source = HEADER
    + "requirement R-001\n  states\n    One.\n"
    + "requirement R-002\n  states\n    As in [R-001] and nothing besides.\n";
  assert.match(messages(warningsOf(source)),
    /requirement R-002 refers to no entity/);
});

test("plain text drops the markup", () => {
  const module = parse(
    HEADER + "requirement R-001\n  states\n    Given [order|an order].\n");
  assert.equal((declaration(module) as Requirement).states!.plain, "Given an order.");
});

// --- name resolution ------------------------------------------------------

test("an unknown supertype", () => {
  assert.match(messages(errors(check(HEADER + "entity order : missing\n"))),
    /"missing" is not declared/);
});

test("a cycle of supertypes", () => {
  assert.match(messages(errors(check(HEADER + "entity a : b\nentity b : a\n"))),
    /closes on/);
});

test("a supertype must be an entity", () => {
  const source = HEADER + "enum state\n  draft\nentity a : state\n";
  assert.match(messages(errors(check(source))), /not an entity/);
});

test("a duplicate name", () => {
  const source = HEADER + "entity a : thing\nentity a : thing\n";
  assert.match(messages(errors(check(source))), /is already declared/);
});

test("a duplicate part", () => {
  const source = HEADER + "entity a : thing\n  p : text\n  p : text\n";
  assert.match(messages(errors(check(source))), /is declared twice/);
});

test("an inherited part cannot be redefined", () => {
  const source = HEADER
    + "entity a : thing\n  p : text\nentity b : a\n  p : text\n";
  assert.match(messages(errors(check(source))), /already exists on the/);
});

test("thing is not the type of a part", () => {
  const source = HEADER + "entity a : thing\n  p : thing\n";
  assert.match(messages(errors(check(source))), /the top of the hierarchy/);
});

test("the supertype of an entity is optional", () => {
  const entity = entityOf(HEADER + "entity alone\n  means\n    Attached to nothing.\n");
  assert.equal(entity.supertype, "");
  assert.deepEqual(errors(check(HEADER + "entity alone\n")), []);
});

test("the supertype of a value is required", () => {
  assert.throws(() => parse(HEADER + "value alone\n"), /a colon/);
});

test("a label requires a hyphen", () => {
  assert.throws(() => parse(HEADER + "requirement NFR7\n  states\n    Text.\n"),
    /unexpected character/);
});

test("the supertype of an entity cannot be a value", () => {
  const source = HEADER + "value number : thing\nentity a : number\n";
  assert.match(messages(errors(check(source))), /not an entity/);
});

test("the supertype of a value cannot be an entity", () => {
  const source = HEADER + "entity record : thing\nvalue a : record\n";
  assert.match(messages(errors(check(source))), /not a value/);
});

test("a duplicate value of an enum", () => {
  const source = HEADER + "enum state\n  draft\n  draft\n";
  assert.match(messages(errors(check(source))), /repeats/);
});

test("an unknown reference", () => {
  const source = HEADER
    + "requirement R-001\n  states\n    A reference to [missing|missing].\n";
  assert.match(messages(errors(check(source))), /"missing" is not declared/);
});

test("a label that exists nowhere is prose all the same", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    See [R-099], about an [order|order].\n";
  assert.deepEqual(errors(check(source)), []);
});

test("uses restricts the modules", () => {
  const extra = {
    other: "language 0.1.0\nmodule other\nentity record : thing\n",
    nothing: "language 0.1.0\nmodule nothing\n",
  };
  const source = HEADER + "  uses nothing\nentity a : other:record\n";
  assert.match(messages(errors(check(source, extra))), /is not listed in "uses"/);
});

test("a qualified reference resolves", () => {
  const extra = { other: "language 0.1.0\nmodule other\nentity record : thing\n" };
  const source = HEADER + "  uses other\nentity a : other:record\n";
  assert.deepEqual(errors(check(source, extra)), []);
});

// --- an address: a part, a value of an enum, one of several ---------------

const SHOP = HEADER
  + "enum order-state\n  placed\n  cancelled\n"
  + "value delivery-address : core:text\n"
  + "entity order : thing\n"
  + "  order-state      : order-state\n"
  + "  delivery-address : delivery-address\n";

const CORE = {
  core: "language 0.1.0\nmodule core\nvalue text : thing\n",
};

function shop(states: string, because = "A reason for the rule.\n"): Diagnostic[] {
  return errors(check(
    SHOP + `requirement R-001\n  states\n    ${states}\n  because\n    ${because}`,
    CORE,
  ));
}

test("a reference to a part of an entity resolves", () => {
  assert.deepEqual(shop("The [order.delivery-address|delivery address] is filled."), []);
});

test("a reference to a part that does not exist", () => {
  assert.match(messages(shop("The [order.total|total] is counted.")),
    /"order" has no part "total"/);
});

test("a part inherited from a supertype resolves", () => {
  const source = HEADER
    + "entity record : thing\n  identifier : identifier\n"
    + "value identifier : core:text\n"
    + "entity order : record\n"
    + "requirement R-001\n  states\n    The [order.identifier|number] is unique.\n"
    + "  because\n    Two orders must be told apart.\n";
  assert.deepEqual(errors(check(source, CORE)), []);
});

test("a reference to a value of an enum resolves", () => {
  assert.deepEqual(
    shop("An [order|order] that is [order-state.placed|placed] is paid for."), []);
});

test("a reference to a value an enum does not hold", () => {
  assert.match(messages(shop("An [order|order] is [order-state.shipped|shipped].")),
    /enum "order-state" has no value "shipped"/);
});

test("a value has no parts", () => {
  assert.match(messages(shop("The [delivery-address.city|city] is filled.")),
    /"delivery-address" is a value, and a value has no parts/);
});

test("thing has no parts", () => {
  assert.match(messages(shop("The [thing.name|name] is filled.")),
    /is the top of the hierarchy and has no parts/);
});

test("a part of a foreign entity resolves", () => {
  const extra = {
    other: "language 0.1.0\nmodule other\nvalue size : thing\n"
      + "entity box : thing\n  size : size\n",
  };
  const source = HEADER + "  uses other\n"
    + "requirement R-001\n  states\n    The [other:box.size|size] is known.\n"
    + "  because\n    A box is carried by its size.\n";
  assert.deepEqual(errors(check(source, extra)), []);
});

test("an introduced name tells two things of one type apart", () => {
  assert.deepEqual(shop(
    "An [order#source|order] merges into an [order#target|another order] when"
    + " [source.order-state|its state] is [order-state.placed|placed]."), []);
});

test("the type is not written after the name is introduced", () => {
  assert.match(
    messages(shop("An [order#source|order] keeps its"
      + " [order#source.order-state|state].")),
    /the type stands where "source" is introduced — write \[source.order-state\|…\]/);
});

test("a name that was never introduced is not a name", () => {
  assert.match(
    messages(shop("An [order#source|order] keeps its [sorce.order-state|state].")),
    /"sorce" is not declared in module "probe"/);
});

test("a name introduced twice is refused", () => {
  assert.match(
    messages(shop("An [order#source|order] merges into the"
      + " [order#source|same order].")),
    /"source" is introduced twice/);
});

test("an introduced name may not repeat a declared one", () => {
  assert.match(
    messages(shop("An [order#order-state|order] is placed.")),
    /"order-state" is declared in module "probe"/);
});

test("a name introduced in states may be used in because", () => {
  assert.deepEqual(shop(
    "An [order#source|order] is merged.",
    "Its [source.order-state|state] decides whether it may be.\n"), []);
});

test("a part of an introduced name is checked against its type", () => {
  assert.match(
    messages(shop("An [order#source|order] keeps its [source.total|total].")),
    /"source" was introduced as "order", which has no part "total"/);
});

test("a value of an enum belongs to the enum, not to a name", () => {
  assert.match(
    messages(shop("The [order-state#before|state before] of an [order|order] is"
      + " [before.placed|placed].")),
    /belongs to the enum, not to "before" — write \[order-state.placed\|…\]/);
});

test("an introduced name needs no part", () => {
  assert.deepEqual(shop(
    "The [order-state#before|state before] and the [order-state#after|state after]"
    + " of an [order|order] differ."), []);
});

test("a named type no longer stands for a thing", () => {
  assert.match(
    messages(shop("An [order#source|order] merges into an [order#target|another"
      + " order], and the [order|order] is closed.")),
    /this text names what is of type "order" — write "source" or "target"/);
});

test("a part is reached through the name, not through the type", () => {
  assert.match(
    messages(shop("An [order#source|order] keeps its"
      + " [order.delivery-address|address].")),
    /write "source" instead of the type/);
});

test("a value of an enum is reached through the enum however it is named", () => {
  assert.deepEqual(shop(
    "The [order-state#before|state before] of an [order|order] was"
    + " [order-state.placed|placed]."), []);
});

test("a name alone stands for the thing it was introduced as", () => {
  assert.deepEqual(shop(
    "An [order#source|order] merges into an [order#target|another order],"
    + " and [source|the first] is closed."), []);
});

test("an address is one part deep", () => {
  assert.match(messages(shop("The [order.delivery-address.city|city] is filled.")),
    /is neither a label nor an address/);
});

test("a part reference counts as mentioning the entity", () => {
  const source = SHOP
    + "requirement R-001\n  states\n    The [order.delivery-address|address] is filled.\n"
    + "  because\n    A parcel goes somewhere.\n";
  assert.doesNotMatch(messages(check(source, CORE)), /"order" is mentioned nowhere/);
});

test("a duplicate label", () => {
  const source = HEADER
    + "requirement R-001\n  states\n    One.\n"
    + "requirement R-001\n  states\n    Two.\n";
  assert.match(messages(errors(check(source))), /is already taken/);
});

// --- warnings -------------------------------------------------------------

function warningsOf(source: string): Diagnostic[] {
  return check(source).filter((item) => item.severity === WARNING);
}

test("a requirement without because warns", () => {
  const source = HEADER
    + "entity a : thing\nrequirement R-001\n  states\n    About [a].\n";
  assert.match(messages(warningsOf(source)), /without "because"/);
});

test("a requirement without references warns", () => {
  const source = HEADER + "requirement R-001\n  states\n    It refers to nothing.\n";
  assert.match(messages(warningsOf(source)), /refers to no entity/);
});

test("an exclusion without because warns", () => {
  const source = HEADER + "exclude X-001\n  states\n    A refusal of the mode.\n";
  assert.match(messages(warningsOf(source)), /exclusion X-001 without "because"/);
});

test("an exclusion needs no references", () => {
  const source = HEADER
    + "exclude X-001\n  states\n    A refusal.\n  because\n    A reason.\n";
  assert.doesNotMatch(messages(warningsOf(source)), /refers to no entity/);
});

test("a reference of an exclusion resolves", () => {
  const source = HEADER
    + "entity order : thing\n"
    + "exclude X-001\n  states\n    Refunding an [order|order] is out.\n"
    + "  because\n    It needs reconciliation with the provider.\n";
  assert.deepEqual(errors(check(source)), []);
});

test("the label of an exclusion must be unique", () => {
  const source = HEADER
    + "requirement X-001\n  states\n    One.\n"
    + "exclude X-001\n  states\n    Two.\n";
  assert.match(messages(errors(check(source))), /is already taken/);
});

test("a short means warns", () => {
  const source = HEADER + "entity a : thing\n  means\n    Short.\n";
  assert.match(messages(warningsOf(source)), /looks like a stub/);
});

test("a dead name warns only where requirements live", () => {
  const dictionary = HEADER + "entity unused : thing\n";
  assert.doesNotMatch(messages(warningsOf(dictionary)), /mentioned nowhere/);

  const withRequirement = HEADER
    + "entity unused : thing\n"
    + "entity used : thing\n"
    + "requirement R-001\n  states\n    About [used].\n";
  assert.match(messages(warningsOf(withRequirement)), /mentioned nowhere/);
});

// --- the set --------------------------------------------------------------

test("the set rejects a module name that does not match the file", () => {
  const root = temporary();
  writeFileSync(join(root, "alpha.canon"), "language 0.1.0\nmodule beta\n");
  assert.match(messages(load([root]).diagnostics), /does not match the file/);
});

test("the set rejects a duplicate module", () => {
  const root = temporary();
  for (const folder of ["one", "two"]) {
    mkdirSync(join(root, folder));
    writeFileSync(join(root, folder, "same.canon"), "language 0.1.0\nmodule same\n");
  }
  assert.match(messages(load([root]).diagnostics), /is already declared in/);
});

test("the library has no errors", () => {
  const world = load([STDLIB, PROFILE]);
  assert.deepEqual(world.diagnostics, []);
  assert.deepEqual(errors(resolve(world)), []);
});

// The examples answer for the language as it stands: an example that has
// gone stale is worse than none, being read as a model. So not a warning
// either — a dead name or a requirement without a reason would be a
// demonstration of what nobody should write.
test("the examples have neither errors nor warnings", () => {
  const world = load([STDLIB, EXAMPLES]);
  assert.deepEqual(world.diagnostics, []);
  assert.deepEqual(resolve(world).map((item) => item.message), []);
});

test("every declaration in the library has means", () => {
  const world = load([STDLIB]);
  const missing = [...world.modules.values()].flatMap((module) =>
    module.named.filter((node) => node.means === null)
      .map((node) => `${module.name}:${node.name}`));
  assert.deepEqual(missing, []);
});

// --- the manifest ---------------------------------------------------------

test("the manifest names the paths of the set", () => {
  const root = temporary();
  const path = manifest(root, 'paths = ["./vocabulary", "./spec"]\n');
  const readManifest = read(path);
  assert.deepEqual(readManifest.paths, [
    join(root, ".canon", "vocabulary"), join(root, ".canon", "spec"),
  ]);
});

test("the manifest is found above the current directory", () => {
  const root = temporary();
  manifest(root, 'paths = ["./stdlib"]\n');
  const deep = join(root, "one", "two");
  mkdirSync(deep, { recursive: true });
  assert.deepEqual(discover(deep).paths, [join(root, ".canon", "stdlib")]);
});

test("a manifest without paths is rejected", () => {
  const root = temporary();
  const path = manifest(root, 'paths = []\n');
  assert.throws(() => read(path), /names no path/);
});

test("paths given as anything but strings are rejected", () => {
  const root = temporary();
  const path = manifest(root, 'paths = [1]\n');

  assert.throws(() => read(path), /"paths" is a list of paths and package names/);
});

test("a directory of the set carries nothing but its modules", () => {
  const root = temporary();
  const path = manifest(root, 'paths = ["./spec"]\n');

  const [source] = read(path).sources;

  assert.equal(source.named, "./spec");
  assert.equal(source.docs, null);
  assert.equal(source.examples, null);
});

test("a package is named in the set and found where it was installed", () => {
  const root = temporary();
  const vocabulary = join(root, "node_modules", "@acme", "vocabulary");
  mkdirSync(vocabulary, { recursive: true });
  writeFileSync(join(vocabulary, "package.json"),
    '{ "name": "@acme/vocabulary", "version": "1.0.0" }');
  const path = manifest(root, 'paths = ["@acme/vocabulary", "./spec"]\n');

  const readManifest = read(path);

  // No "canon" field: the package is the vocabulary, whole.
  assert.deepEqual(readManifest.paths, [vocabulary, join(root, ".canon", "spec")]);
});

test("a package says for itself what it holds and where", () => {
  const root = temporary();
  const vocabulary = join(root, "node_modules", "@acme", "vocabulary");
  mkdirSync(vocabulary, { recursive: true });
  writeFileSync(join(vocabulary, "package.json"),
    '{ "name": "@acme/vocabulary", "version": "1.0.0",'
    + ' "canon": { "stdlib": "modules", "docs": "prose", "examples": "shown" } }');
  const path = manifest(root, 'paths = ["@acme/vocabulary", "./spec"]\n');

  const [source] = read(path).sources;

  // Named once: the modules, the definition of the language and the examples
  // all come from the one name, because the package answers for all three.
  assert.equal(source.path, join(vocabulary, "modules"));
  assert.equal(source.docs, join(vocabulary, "prose"));
  assert.equal(source.examples, join(vocabulary, "shown"));
});

test("a package that is not installed is reported by name", () => {
  const root = temporary();
  const path = manifest(root, 'paths = ["@acme/nowhere"]\n');

  assert.throws(() => read(path),
    /"paths" names the package "@acme\/nowhere", and it is not installed/);
});

test("a missing manifest is reported", () => {
  const root = temporary();
  assert.throws(() => discover(root), ManifestError);
});

test("a manifest at the project root is not discovered", () => {
  const root = temporary();
  writeFileSync(join(root, "canon.toml"), 'paths = ["spec"]\n');

  assert.throws(() => discover(root), /no \.canon\/canon\.toml/);
});

// --- documents and highlighting stay in step ------------------------------

test("the grammar lists every keyword", () => {
  const text = read_(GRAMMAR);
  const body = text.split("keyword      =")[1].split(";")[0];
  const found = [...body.matchAll(/"([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(found)].sort(), [...KEYWORDS].sort());
});

test("the prose lists every keyword", () => {
  const text = read_(LANGUAGE);
  const block = text.split("## Keywords")[1].split("There are no kinds of value")[0];
  const found = [...block.matchAll(/`([a-z]+)`/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(found)].sort(), [...KEYWORDS].sort());
});

test("the highlighting lists every keyword", () => {
  const grammar = JSON.stringify(JSON.parse(read_(TMLANGUAGE)));
  for (const keyword of KEYWORDS) {
    assert.match(grammar, new RegExp(`\\b${keyword}\\b`), keyword);
  }
});

test("the highlighting knows every form of an address", () => {
  const grammar = JSON.parse(read_(TMLANGUAGE));
  const reference = new RegExp(grammar.repository.reference.begin);
  const targets = [
    "order", "data:record", "order.order-state", "order-state.placed",
    "order#source", "source", "source.order-state", "order#source.order-state",
    "Order", "order.items.price", "order:", "2order",
  ];
  for (const target of targets) {
    assert.equal(
      reference.test(`[${target}|caption]`), address(target) !== null, target);
  }
  // A caption is required, and a bracket written as a bracket is prose.
  assert.doesNotMatch("[order]", reference);
  assert.doesNotMatch("\\[order|order]", reference);
});
