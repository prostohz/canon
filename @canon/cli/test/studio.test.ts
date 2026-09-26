import assert from "node:assert/strict";
import { test } from "node:test";

import { World, parse, resolve } from "@canonspec/lang";

import { build } from "../src/studio/model.js";

const HEADER = "language 0.1.0\nmodule probe\n";

function view(source: string) {
  const world = new World();
  const module = parse(source);
  module.path = "probe.canon";
  world.modules.set(module.name, module);
  return build(world, resolve(world));
}

test("the composition shows what is inherited and where it came from", () => {
  const world = view(
    HEADER
    + "entity record : thing\n  number : text\n"
    + "entity order : record\n  total : text\n",
  );
  const order = world.modules[0].declarations[1];
  assert.deepEqual(order.parts?.map((part) => part.name), ["total"]);
  assert.deepEqual(order.inherited?.map((part) => [part.name, part.inherited]),
    [["number", "probe:record"]]);
  assert.deepEqual(order.ancestors, ["probe:record"]);
});

test("a requirement carries its obligation, written or not", () => {
  const world = view(
    HEADER
    + "requirement R-001\n  states\n    One.\n"
    + "requirement R-002\n  states\n    Two.\n  obligation recommended\n"
    + "assume A-001\n  states\n    An assumption.\n",
  );
  assert.deepEqual(
    world.modules[0].declarations.map((node) => node.obligation),
    ["mandatory", "recommended", ""],
  );
});

test("an entity carries the requirements that mention it", () => {
  const world = view(
    HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    About an [order|order].\n",
  );
  const order = world.modules[0].declarations[0];
  assert.deepEqual(order.mentions, [
    { module: "probe", name: "R-001", kind: "requirement" },
  ]);
});

test("a reference to a part mentions the entity holding it, once", () => {
  const world = view(
    HEADER
    + "value text : thing\n"
    + "entity order : thing\n  total : text\n"
    + "requirement R-001\n  states\n"
    + "    The [order.total|total] of an [order|order] is counted.\n",
  );
  const order = world.modules[0].declarations[1];
  assert.deepEqual(order.mentions, [
    { module: "probe", name: "R-001", kind: "requirement" },
  ]);
});

test("a label in prose is not taken for an entity", () => {
  const world = view(
    HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    About an [order|order].\n"
    + "requirement R-002\n  states\n    As in [R-001], about an [order|order].\n",
  );
  const order = world.modules[0].declarations[0];
  assert.deepEqual(order.mentions?.map((mention) => mention.name), ["R-001", "R-002"]);
});

test("a statement shows both ends of every link", () => {
  const world = view(
    HEADER
    + "assume A-001\n  states\n    An assumption.\n"
    + "requirement R-001\n  given A-001\n  states\n    One.\n"
    + "requirement R-002\n  replaces R-001\n  states\n    Two.\n",
  );
  const [assumption, first, second] = world.modules[0].declarations;
  assert.deepEqual(assumption.underlies, ["R-001"]);
  assert.deepEqual(first.given, ["A-001"]);
  assert.deepEqual(first.replacedBy, ["R-002"]);
  assert.deepEqual(second.replaces, ["R-001"]);
});

test("a replaced statement is shown out of force and counted", () => {
  const world = view(
    HEADER
    + "requirement R-001\n  states\n    One.\n"
    + "requirement R-002\n  replaces R-001\n  states\n    Two.\n",
  );
  assert.deepEqual(
    world.modules[0].declarations.map((node) => node.inForce), [false, true]);
  assert.equal(world.totals.replaced, 1);
  assert.equal(world.totals.requirements, 2);
});

test("the totals count what the set holds", () => {
  const world = view(
    HEADER
    + "entity order : thing\n"
    + "requirement R-001\n  states\n    About an [order|order].\n"
    + "exclude X-001\n  states\n    A refusal.\n  because\n    A reason.\n",
  );
  assert.equal(world.totals.modules, 1);
  assert.equal(world.totals.named, 1);
  assert.equal(world.totals.requirements, 1);
  assert.equal(world.totals.exclusions, 1);
  assert.equal(world.totals.errors, 0);
});

test("the diagnostics of a module are laid out by its path", () => {
  const world = view(HEADER + "entity order : missing\n");
  assert.ok(world.modules[0].problems.length > 0);
  assert.match(world.modules[0].problems[0].message, /is not declared/);
  assert.equal(world.totals.errors, world.modules[0].problems.filter(
    (problem) => problem.severity === "error").length);
});
