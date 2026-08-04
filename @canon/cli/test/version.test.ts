import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { versions } from "../src/version.js";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "cli.js");

test("version names what is installed and the format it understands", async () => {
  const lines = await versions();

  assert.equal(lines.length, 4);
  assert.match(lines[0], /^@canon\/cli\s+\d+\.\d+\.\d+/);
  assert.match(lines[1], /^@canon\/lang\s+\d+\.\d+\.\d+/);
  assert.match(lines[2], /^@canon\/studio\s+\d+\.\d+\.\d+/);
  // The format is a version of its own: a release of the language may leave
  // it where it was, and a specification is written against it, not against
  // the release.
  assert.match(lines[3], /^format\s+\d+\.\d+\.\d+/);
});

for (const asked of ["version", "-v", "--version"]) {
  test(`the command answers to ${asked}`, () => {
    const done = spawnSync(process.execPath, [CLI, asked], { encoding: "utf8" });

    assert.equal(done.status, 0);
    assert.match(done.stdout, /@canon\/cli\s+\d+\.\d+\.\d+/);
  });
}
