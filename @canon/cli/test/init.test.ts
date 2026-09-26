import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { read } from "@canonspec/lang";

import { detectHarnesses } from "../src/harness/index.js";
import { init } from "../src/init.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function named(manifest: string, pattern: RegExp): string {
  const found = manifest.match(pattern);
  assert.ok(found, `the manifest names nothing for ${pattern}`);
  return found[1];
}

async function project(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "canon-cli-"));
}

function manifest(root: string): string {
  return join(root, ".canon", "canon.toml");
}

interface Run {
  readonly status: number;
  readonly out: string;
}

function run(cwd: string, ...args: string[]): Run {
  const done = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { status: done.status ?? -1, out: done.stdout + done.stderr };
}

test("init names the language as a package, not as a place", async () => {
  const root = await project();
  await init({ root });

  const content = await readFile(manifest(root), "utf8");
  assert.match(content, /"\.\/spec"/);
  assert.equal(named(content, /"(@canonspec\/lang)"/), "@canonspec/lang");

  // Nothing of the machine it was run on: the manifest travels with the
  // project, and the package is found wherever the next machine put it.
  assert.ok(!content.includes("node_modules"), content);
  assert.ok(!content.includes(".."), content);

  await readFile(join(root, ".canon", "spec", "README.md"), "utf8");
});

test("the set a manifest names is the vocabulary and what is written on it", async () => {
  const root = await project();
  await init({ root });

  const set = read(manifest(root)).paths;

  assert.equal(set.length, 2);
  assert.match(await readFile(join(set[0], "core.canon"), "utf8"), /^language /);
  assert.equal(set[1], join(root, ".canon", "spec"));
});

test("init copies nothing into the project", async () => {
  const root = await project();
  await init({ root });

  assert.deepEqual((await readdir(join(root, ".canon"))).sort(), ["canon.toml", "spec"]);
  assert.deepEqual(await readdir(root), [".canon"]);
});

test("init keeps the spec and the manifest of the project", async () => {
  const root = await project();
  await init({ root });
  await writeFile(join(root, ".canon", "spec", "own.canon"), "language 0.1.0\n");
  await writeFile(manifest(root), "paths = [\"./elsewhere\"]\n");

  const done = await init({ root });

  assert.equal(await readFile(join(root, ".canon", "spec", "own.canon"), "utf8"),
    "language 0.1.0\n");
  assert.equal(await readFile(manifest(root), "utf8"),
    "paths = [\"./elsewhere\"]\n");
  assert.ok(done.some((line) => line.startsWith("kept      .canon/canon.toml")));
});

test("force replaces the manifest", async () => {
  const root = await project();
  await init({ root });
  await writeFile(manifest(root), "paths = []\n");

  await init({ root, force: true });

  assert.match(await readFile(manifest(root), "utf8"),
    /paths = \[\n    "@canonspec\/lang",\n    "\.\/spec"/);
});

test("init writes Codex skills into its project discovery layout", async () => {
  const root = await project();

  await init({ root, harnesses: ["codex"] });

  const skill = await readFile(
    join(root, ".agents", "skills", "canon-spec", "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: canon-spec\n/);
  assert.match(skill, /`\.canon\/workflow\.md`/);
  assert.match(skill, /# Specification author/);
  assert.match(skill, /`canon_spec_reviewer` subagent/);
  const reviewer = await readFile(
    join(root, ".codex", "agents", "canon-spec-reviewer.toml"), "utf8");
  assert.match(reviewer, /^name = "canon_spec_reviewer"/);
  assert.match(reviewer, /sandbox_mode = "read-only"/);
  assert.match(reviewer, /# Specification reviewer/);
  assert.match(
    await readFile(join(root, ".agents", "skills", "canon-review", "SKILL.md"), "utf8"),
    /`canon_implementation_reviewer` subagent/,
  );
  assert.equal(await exists(join(root, ".canon", "agent")), false);
  assert.equal(await exists(join(root, ".claude")), false);
});

test("init writes Claude skills and independent reviewer subagents", async () => {
  const root = await project();

  await init({ root, harnesses: ["claude"] });

  const skill = await readFile(
    join(root, ".claude", "skills", "canon-review", "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: canon-review\n/);
  assert.match(skill, /`canon-implementation-reviewer` subagent/);
  // The name is in the front matter; a heading repeating it says nothing.
  assert.ok(!skill.includes("# canon-review"), skill);
  assert.match(
    await readFile(join(root, ".claude", "skills", "canon-spec", "SKILL.md"), "utf8"),
    /`canon-spec-reviewer` subagent/,
  );
  const reviewer = await readFile(
    join(root, ".claude", "agents", "canon-implementation-reviewer.md"), "utf8");
  assert.match(reviewer, /^---\nname: canon-implementation-reviewer\n/);
  assert.match(reviewer, /tools: Read, Glob, Grep, Bash/);
  assert.match(reviewer, /`\.canon\/workflow\.md`/);
  assert.match(reviewer, /# Implementation reviewer/);
  assert.equal(await exists(join(root, ".canon", "agent")), false);
  assert.equal(await exists(join(root, ".agents")), false);
});

// A skill names an agent this harness installed, never "a subagent": an
// unnamed one is spawned without the role it is being asked to play.
test("every reviewer a skill delegates to is a reviewer init wrote", async () => {
  const root = await project();

  await init({ root, harnesses: ["codex", "claude"] });

  for (const layout of [".agents", ".claude"]) {
    for (const skill of await readdir(join(root, layout, "skills"))) {
      const content = await readFile(
        join(root, layout, "skills", skill, "SKILL.md"), "utf8");
      for (const [, name] of content.matchAll(/`(canon[-_]\w+?[-_]reviewer)` subagent/g)) {
        const installed = layout === ".claude"
          ? join(root, ".claude", "agents", `${name}.md`)
          : join(root, ".codex", "agents", `${name.replaceAll("_", "-")}.toml`);
        assert.equal(await exists(installed), true, `${skill} names ${name}`);
      }
    }
  }
});

// The stages are stated once. A skill that carried its own copy of them
// would have to be found and edited whenever the workflow moved.
test("the workflow is one file and no generated file copies it", async () => {
  const root = await project();

  await init({ root, harnesses: ["codex", "claude"] });

  const workflow = await readFile(join(root, ".canon", "workflow.md"), "utf8");
  assert.match(workflow, /# Canon workflow/);
  assert.match(workflow, /Keep these stages separate/);

  for (const generated of [
    join(root, ".agents", "skills", "canon-spec", "SKILL.md"),
    join(root, ".claude", "skills", "canon-implement", "SKILL.md"),
    join(root, ".claude", "agents", "canon-spec-reviewer.md"),
    join(root, ".codex", "agents", "canon-implementation-reviewer.toml"),
  ]) {
    const content = await readFile(generated, "utf8");
    assert.ok(!content.includes("Keep these stages separate"), generated);
    assert.match(content, /`\.canon\/workflow\.md`/);
  }
});

test("init keeps an edited skill unless force is given", async () => {
  const root = await project();
  const path = join(root, ".agents", "skills", "canon-spec", "SKILL.md");
  await init({ root, harnesses: ["codex"] });
  await writeFile(path, "project instructions\n", "utf8");

  await init({ root, harnesses: ["codex"] });
  assert.equal(await readFile(path, "utf8"), "project instructions\n");

  await init({ root, harnesses: ["codex"], force: true });
  assert.match(await readFile(path, "utf8"), /^---\nname: canon-spec\n/);
});

test("detects harnesses from their existing project files", async () => {
  const root = await project();
  await writeFile(join(root, "AGENTS.md"), "# Agents\n");
  await mkdir(join(root, ".claude"));

  assert.deepEqual(await detectHarnesses(root), ["codex", "claude"]);
});

test("the CLI accepts one harness non-interactively", async () => {
  const root = await project();

  const done = run(root, "init", "--harness", "codex");

  assert.equal(done.status, 0, done.out);
  assert.equal(await exists(join(root, ".agents", "skills", "canon-spec", "SKILL.md")), true);
  assert.equal(await exists(join(root, ".claude", "skills", "canon-spec", "SKILL.md")), false);
});

test("the CLI rejects an unknown harness without writing a project", async () => {
  const root = await project();

  const done = run(root, "init", "--harness", "other");

  assert.equal(done.status, 2);
  assert.match(done.out, /--harness takes one of codex, claude/);
  assert.deepEqual(await readdir(root), []);
});

test("the CLI requires a choice when several harnesses are detected", async () => {
  const root = await project();
  await writeFile(join(root, "AGENTS.md"), "# Agents\n");
  await mkdir(join(root, ".claude"));

  const done = run(root, "init");

  assert.equal(done.status, 2);
  assert.match(done.out, /multiple AI harnesses detected/);
  assert.equal(await exists(manifest(root)), false);
});

test("the CLI requires a choice when no harness is detected non-interactively", async () => {
  const root = await project();

  const done = run(root, "init");

  assert.equal(done.status, 2);
  assert.match(done.out, /no AI harness detected/);
  assert.equal(await exists(manifest(root)), false);
});

test("check reads the manifest an init wrote", async () => {
  const root = await project();
  await init({ root });
  await writeFile(join(root, ".canon", "spec", "orders.canon"),
    "language 0.1.0\nmodule orders\n  uses core\n  means\n    Orders.\n\n"
    + "value order-number : core:text\n");

  const done = run(root, "check");

  assert.equal(done.status, 0);
  assert.match(done.out, /summary/);
  assert.match(done.out, /modules\s+28/);
});

test("check reports a reference to what is not declared", async () => {
  const root = await project();
  await init({ root });
  await writeFile(join(root, ".canon", "spec", "orders.canon"),
    "language 0.1.0\nmodule orders\n  uses core\n  means\n    Orders.\n\n"
    + "requirement R-1\n  states\n    An [order|order] is paid for.\n");

  const done = run(root, "check");

  assert.equal(done.status, 1);
  assert.match(done.out, /"order" is not declared/);
});

test("check without a manifest says so", async () => {
  const root = await project();

  const done = run(root, "check");

  assert.equal(done.status, 2);
  assert.match(done.out, /no \.canon\/canon\.toml/);
});

test("a project may speak a vocabulary of its own", async () => {
  const root = await project();
  await init({ root });
  const own = join(root, "vocabulary");
  await mkdir(own, { recursive: true });
  await writeFile(join(own, "own.canon"),
    "language 0.1.0\nmodule own\n  means\n    A vocabulary of its own.\n");
  await writeFile(manifest(root), 'paths = ["../vocabulary", "./spec"]\n');

  const set = read(manifest(root)).paths;

  assert.deepEqual(set, [own, join(root, ".canon", "spec")]);
});
