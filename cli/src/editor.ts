import { access, cp, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION = join(HERE, "..", "..", "extension");

export const EXTENSIONS = join(homedir(), ".vscode", "extensions");

const PACKAGING: ReadonlySet<string> = new Set([
  "package-lock.json", "node_modules", ".gitignore", ".vscodeignore",
]);

export interface EditorOptions {
  directory?: string;
  link?: boolean;
}

interface Manifest {
  name: string;
  publisher: string;
  version: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function source(): Promise<string> {
  if (await exists(join(EXTENSION, "package.json"))) return EXTENSION;
  throw new Error("the bundled extension is missing");
}

async function manifest(from: string): Promise<Manifest> {
  const read = JSON.parse(await readFile(join(from, "package.json"), "utf8"));
  for (const field of ["name", "publisher", "version"] as const) {
    if (typeof read[field] !== "string") {
      throw new Error(`the extension declares no ${field}`);
    }
  }
  return read as Manifest;
}

async function earlier(root: string, of: Manifest): Promise<string[]> {
  const prefixes = [`${of.publisher}.${of.name}-`, "canon.canon-vscode-"];
  try {
    return (await readdir(root)).filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
  } catch {
    return [];
  }
}

export async function editor({ directory, link = false }: EditorOptions = {}): Promise<string[]> {
  const from = await source();
  const declared = await manifest(from);
  const root = resolve(directory ?? EXTENSIONS);
  const name = `${declared.publisher}.${declared.name}-${declared.version}`;
  const to = join(root, name);
  const done: string[] = [];

  await mkdir(root, { recursive: true });
  for (const old of await earlier(root, declared)) {
    await rm(join(root, old), { recursive: true, force: true });
    if (old !== name) done.push(`removed   ${old}`);
  }

  if (link) {
    await symlink(from, to, "dir");
    done.push(`linked    ${name} -> ${from}`);
  } else {
    await cp(from, to, {
      recursive: true,
      filter: (path) => path === from || !PACKAGING.has(relative(from, path).split(sep)[0]),
    });
    done.push(`installed ${name}`);
  }

  done.push(`in        ${root}`);
  done.push("restart the editor for it to be picked up");
  return done;
}
