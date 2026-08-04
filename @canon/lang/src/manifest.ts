import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseToml } from "smol-toml";

export const NAME = join(".canon", "canon.toml");
const FILE = "canon.toml";

/**
 * What a package holding a vocabulary says about itself: where in it the
 * modules lie, and where the definition of the language does. Without the
 * field the package is the directory — a vocabulary and nothing else.
 */
interface Carried {
  readonly stdlib?: string;
  readonly docs?: string;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/** The written form of a set: the paths making up one delivery. */
export interface Manifest {
  readonly path: string;
  readonly paths: string[];
  /**
   * The vocabulary the specifications are written against, checked with
   * them. Named as a package or as a directory; a project speaking its own
   * vocabulary names its own package here.
   */
  readonly stdlib: string | null;
  /**
   * Where the definition of the language lies, for whoever reads or writes a
   * specification. Nothing is checked against it — it is prose — but a set
   * says where it is instead of leaving it to be found.
   */
  readonly docs: string | null;
}

function real(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * A path is written as one: it begins where paths begin. Anything else is
 * the name of a package, resolved where whoever installed it put it —
 * beside the project, above it, or globally.
 */
function isPath(value: string): boolean {
  return value.startsWith(".") || isAbsolute(value);
}

/** Where in an installed package the named thing lies. */
function inPackage(base: string, name: string, within: keyof Carried): string {
  // From the project first, where a dependency of it lies and where its lock
  // file records the version. Then from the tool, which is where a package
  // installed globally beside it can be seen: node resolution walks up from
  // whoever asks, and a global install is above the tool, not above the
  // project.
  const askers = [
    createRequire(pathToFileURL(join(base, FILE))),
    createRequire(import.meta.url),
  ];
  let manifest: string | null = null;
  for (const from of askers) {
    try {
      manifest = from.resolve(`${name}/package.json`);
      break;
    } catch {
      // Not there; the next asker may see it.
    }
  }
  if (manifest === null) {
    throw new Error("it is not installed, or does not let its manifest be read");
  }
  let carried: Carried = {};
  try {
    const read = JSON.parse(readFileSync(manifest, "utf8")) as { canon?: Carried };
    if (read.canon !== undefined) carried = read.canon;
  } catch {
    throw new Error("its manifest cannot be read");
  }
  // A package that says nothing of itself is taken for the thing entire: a
  // vocabulary is a directory of modules and needs no more said about it.
  return join(dirname(manifest), carried[within] ?? ".");
}

/** Looks for a manifest in a directory and in the ones above it. */
export function find(start: string): string | null {
  let current = real(resolve(start));
  for (;;) {
    const candidate = resolve(current, NAME);
    if (isFile(candidate)) return candidate;
    const above = dirname(current);
    if (above === current) return null;
    current = above;
  }
}

export function read(path: string): Manifest {
  let content: unknown;
  try {
    content = parseToml(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ManifestError(
      `${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const base = dirname(path);
  const table = content as Record<string, unknown>;

  function entries(key: string): string[] {
    const value = table[key] ?? [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new ManifestError(`${path}: "${key}" is a list of paths`);
    }
    return (value as string[]).map((item) => resolve(base, item));
  }

  function entry(key: string, within: keyof Carried): string | null {
    const value = table[key];
    if (value === undefined) return null;
    if (typeof value !== "string") {
      throw new ManifestError(`${path}: "${key}" names a package or a path`);
    }
    if (isPath(value)) return resolve(base, value);
    try {
      return inPackage(base, value, within);
    } catch (error) {
      throw new ManifestError(
        `${path}: "${key}" names the package "${value}", and `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const manifest: Manifest = {
    path,
    paths: entries("paths"),
    stdlib: entry("stdlib", "stdlib"),
    docs: entry("docs", "docs"),
  };
  if (!manifest.paths.length) {
    throw new ManifestError(`${path}: "paths" names no path`);
  }
  return manifest;
}

/** The whole set a manifest names: the vocabulary and what is written on it. */
export function whole(manifest: Manifest): string[] {
  return manifest.stdlib === null
    ? manifest.paths : [manifest.stdlib, ...manifest.paths];
}

/** The manifest of the delivery the current directory belongs to. */
export function discover(start?: string): Manifest {
  const found = find(start ?? process.cwd());
  if (found === null) {
    throw new ManifestError(
      `no ${NAME} here or above; name the paths of the set instead`,
    );
  }
  return read(found);
}
