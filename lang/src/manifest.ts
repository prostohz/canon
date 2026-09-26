import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseToml } from "smol-toml";

export const NAME = join(".canon", "canon.toml");
const FILE = "canon.toml";

/**
 * What a package holding modules says about itself: where in it they lie,
 * and where the definition of the language and sets written in it lie beside
 * them. Without the field the package is the directory — modules and nothing
 * else.
 */
interface Carried {
  readonly stdlib?: string;
  readonly docs?: string;
  readonly examples?: string;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/**
 * One entry of a set: modules, and what the package holding them says of
 * itself. A directory says nothing and carries nothing but its modules.
 */
export interface Source {
  /** As the manifest wrote it: the name of a package, or a path. */
  readonly named: string;
  /** Where the modules are read from. */
  readonly path: string;
  /**
   * The definition of the language, where the package carries one. Nothing
   * is checked against it — it is prose — but whoever reads or writes a
   * specification is told where it is rather than left to find it.
   */
  readonly docs: string | null;
  /**
   * Sets written in the language, whole and passing the checker, where the
   * package carries any. For whoever needs the shape of one before writing
   * another; nothing is checked against them either.
   */
  readonly examples: string | null;
}

/** The written form of a set: everything making up one delivery. */
export interface Manifest {
  readonly path: string;
  readonly sources: Source[];
  /** Where the modules of the set lie, in the order the manifest names them. */
  readonly paths: string[];
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

/** What an installed package says of itself, and where it was found. */
function inPackage(base: string, name: string): { at: string; carried: Carried } {
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
  return { at: dirname(manifest), carried };
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

  const value = table.paths ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ManifestError(`${path}: "paths" is a list of paths and package names`);
  }

  /**
   * A directory is a directory of modules and nothing else; a package is
   * asked what it holds, and answers for the modules, the definition of the
   * language and the examples at once. That is why the set names a package
   * once and not three times: what lies where inside it is its own business.
   */
  function source(named: string): Source {
    if (isPath(named)) {
      return { named, path: resolve(base, named), docs: null, examples: null };
    }
    let found: { at: string; carried: Carried };
    try {
      found = inPackage(base, named);
    } catch (error) {
      throw new ManifestError(
        `${path}: "paths" names the package "${named}", and `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const within = (part?: string): string | null =>
      part === undefined ? null : join(found.at, part);
    return {
      named,
      // A package that says nothing of itself is taken for the thing entire.
      path: join(found.at, found.carried.stdlib ?? "."),
      docs: within(found.carried.docs),
      examples: within(found.carried.examples),
    };
  }

  const sources = (value as string[]).map(source);
  if (!sources.length) {
    throw new ManifestError(`${path}: "paths" names no path`);
  }
  return { path, sources, paths: sources.map((item) => item.path) };
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
