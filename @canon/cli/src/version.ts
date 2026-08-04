/** What is installed, and what of it a specification is written against. */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SOURCE } from "./init.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function versionOf(manifest: string): Promise<string> {
  try {
    const read = JSON.parse(await readFile(manifest, "utf8")) as { version?: string };
    return read.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function row(name: string, version: string): string {
  return `${name.padEnd(16)}${version}`;
}

/** Where a package beside this one lies, or nothing if it is not installed. */
function beside(name: string): string | null {
  try {
    return require.resolve(`${name}/package.json`);
  } catch {
    // Not installed beside this one: say so rather than guess.
    return null;
  }
}

export async function versions(): Promise<string[]> {
  const lines = [
    row("@canon/cli", await versionOf(join(HERE, "..", "..", "package.json"))),
  ];

  const language = beside(SOURCE);
  lines.push(row(SOURCE, language === null ? "not installed" : await versionOf(language)));

  const studio = beside("@canon/studio");
  lines.push(row(
    "@canon/studio", studio === null ? "not installed" : await versionOf(studio)));

  // The version of the format, which moves only when the grammar does: the
  // first line of every module is checked against it, and a release of the
  // language may leave it where it was.
  if (language !== null) {
    const { VERSION } = await import(SOURCE);
    lines.push(row("format", VERSION));
  }

  return lines;
}
