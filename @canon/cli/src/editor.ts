/** Laying the extension out where an editor of the VS Code family finds it. */
import { access, cp, mkdir, readFile, readdir, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// The extension carries one manifest for npm and for the editor, and an
// editor will not have a scoped name, so the package is the odd one out:
// canon-vscode where the others are @canon/*. In a checkout it lies under
// the directory name the rest go by.
const PACKAGE = "canon-vscode";
const IN_CHECKOUT = "vscode";

// An editor scans this directory at start-up and takes every folder holding
// a package.json for an extension; the marketplace is not involved.
export const EXTENSIONS = join(homedir(), ".vscode", "extensions");

// What the package carries for npm and not for the editor. package.json is
// not among them: it is the manifest of the extension itself.
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

/** Where the extension is read from: the package, or a checkout. */
export async function source(): Promise<string> {
  const candidates: string[] = [];
  try {
    candidates.push(dirname(require.resolve(`${PACKAGE}/package.json`)));
  } catch {
    // Not installed: a checkout may still hold it beside canon-cli.
  }
  candidates.push(join(HERE, "..", "..", "..", IN_CHECKOUT));

  for (const candidate of candidates) {
    if (await exists(join(candidate, "package.json"))) return candidate;
  }
  throw new Error(`nothing to install from: is ${PACKAGE} installed?`);
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

/** Every folder an earlier install of the same extension may have left. */
async function earlier(root: string, of: Manifest): Promise<string[]> {
  const prefix = `${of.publisher}.${of.name}-`;
  try {
    return (await readdir(root)).filter((name) => name.startsWith(prefix));
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
