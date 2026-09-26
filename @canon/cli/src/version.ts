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
  return `${name.padEnd(18)} ${version}`;
}

function beside(name: string): string | null {
  try {
    return require.resolve(`${name}/package.json`);
  } catch { return null; }
}

export async function versions(): Promise<string[]> {
  const lines = [
    row("@canonspec/cli", await versionOf(join(HERE, "..", "..", "package.json"))),
  ];

  const language = beside(SOURCE);
  lines.push(row(SOURCE, language === null ? "not installed" : await versionOf(language)));

  if (language !== null) {
    const { VERSION } = await import(SOURCE);
    lines.push(row("format", VERSION));
  }

  return lines;
}
