import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { editor } from "../src/editor.js";

const NAME = "canonspec.canonspec-vscode-0.1.1";

async function extensions(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "canon-extensions-"));
}

test("the extension is laid out under publisher, name and version", async () => {
  const directory = await extensions();

  await editor({ directory });

  assert.deepEqual(await readdir(directory), [NAME]);
  const manifest = JSON.parse(
    await readFile(join(directory, NAME, "package.json"), "utf8"),
  );
  assert.equal(manifest.name, "canonspec-vscode");
  assert.equal(manifest.publisher, "canonspec");
  assert.equal(manifest.contributes.languages[0].id, "canon");
  await readFile(join(directory, NAME, "syntaxes", "canon.tmLanguage.json"), "utf8");
});

test("the copy carries nothing of the package it comes from", async () => {
  const directory = await extensions();

  await editor({ directory });

  const laid = await readdir(join(directory, NAME));
  for (const name of [".gitignore", "node_modules", "package-lock.json"]) {
    assert.ok(!laid.includes(name), `${name} was laid out into the extension`);
  }
  assert.ok(laid.includes("package.json"), "the manifest itself must be there");
});

test("an install replaces whatever version was there", async () => {
  const directory = await extensions();
  await mkdir(join(directory, "canon.canon-vscode-0.0.9"), { recursive: true });
  await writeFile(join(directory, "canon.canon-vscode-0.0.9", "package.json"), "{}");
  await mkdir(join(directory, "canonspec.canonspec-vscode-0.1.0"), { recursive: true });
  await writeFile(join(directory, "canonspec.canonspec-vscode-0.1.0", "package.json"), "{}");
  await mkdir(join(directory, "someone.else-1.0.0"), { recursive: true });

  const done = await editor({ directory });

  assert.deepEqual((await readdir(directory)).sort(), [NAME, "someone.else-1.0.0"]);
  assert.ok(done.some((line) => line.startsWith("removed   canon.canon-vscode-0.0.9")));
  assert.ok(done.some((line) => line.startsWith("removed   canonspec.canonspec-vscode-0.1.0")));
});

test("link puts a symlink instead of a copy", async () => {
  const directory = await extensions();

  await editor({ directory, link: true });

  assert.ok((await lstat(join(directory, NAME))).isSymbolicLink());
  const manifest = JSON.parse(
    await readFile(join(directory, NAME, "package.json"), "utf8"),
  );
  assert.equal(manifest.name, "canonspec-vscode");
});

test("an install after a link replaces the link", async () => {
  const directory = await extensions();
  await editor({ directory, link: true });

  await editor({ directory });

  assert.ok(!(await lstat(join(directory, NAME))).isSymbolicLink());
});
