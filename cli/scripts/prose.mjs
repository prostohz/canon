// tsc copies no Markdown, and the prose beside the workflow modules is the
// source of every generated file. It has to stand beside them in dist too,
// where the published tool reads it.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const FROM = "src/workflow";
const TO = "dist/src/workflow";

async function copy(relative) {
  await mkdir(join(TO, relative), { recursive: true });
  for (const entry of await readdir(join(FROM, relative), { withFileTypes: true })) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) await copy(path);
    else if (entry.name.endsWith(".md")) await copyFile(join(FROM, path), join(TO, path));
  }
}

await copy(".");
