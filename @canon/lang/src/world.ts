import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, join, parse as parsePath, resolve } from "node:path";

import { Diagnostic, SpecError } from "./errors.js";
import { Declaration, Module, isStatement } from "./nodes.js";
import { parse } from "./parser.js";
import { VERSION } from "./version.js";

export const SUFFIX = ".canon";

export class World {
  readonly modules = new Map<string, Module>();
  readonly diagnostics: Diagnostic[] = [];

  *declarations(): Generator<[Module, Declaration]> {
    for (const module of this.modules.values()) {
      for (const node of module.declarations) yield [module, node];
    }
  }
}

/**
 * The labels that are no longer in force: those some statement replaces.
 *
 * A replaced statement stays where it was written and is checked as before.
 * It is out of force, not out of the set: what it once promised is the
 * reason for keeping it, and a text left behind unchecked would rot.
 */
export function replaced(world: World): Set<string> {
  const labels = new Set<string>();
  for (const [, node] of world.declarations()) {
    if (!isStatement(node)) continue;
    for (const link of node.replaces) labels.add(link.label);
  }
  return labels;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Every file under a directory, the deepest ones included. */
export function walk(directory: string): string[] {
  const found: string[] = [];
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

export function collect(paths: string[]): string[] {
  const found: string[] = [];
  for (const path of paths) {
    if (isDirectory(path)) {
      found.push(...walk(path).filter((child) => extname(child) === SUFFIX).sort());
    } else if (extname(path) === SUFFIX) {
      found.push(path);
    }
  }
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const path of found) {
    let resolved: string;
    try {
      resolved = realpathSync(path);
    } catch {
      resolved = resolve(path);
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(path);
  }
  return unique;
}

export function load(paths: string[]): World {
  const world = new World();
  const origin = new Map<string, string>();

  for (const path of collect(paths)) {
    let module: Module;
    try {
      module = parse(readFileSync(path, "utf8"));
    } catch (error) {
      if (!(error instanceof SpecError)) throw error;
      world.diagnostics.push(error.diagnostic.at(path));
      continue;
    }
    module.path = path;

    if (module.language !== VERSION) {
      world.diagnostics.push(
        new Diagnostic(
          module.languageLine, 1,
          `format version ${module.language}, the tool understands ${VERSION}`,
          "error", path,
        ),
      );
      continue;
    }
    const stem = parsePath(path).name;
    if (module.name !== stem) {
      world.diagnostics.push(
        new Diagnostic(
          module.line, module.column,
          `module name "${module.name}" does not match the file name "${stem}"`,
          "error", path,
        ),
      );
      continue;
    }
    if (world.modules.has(module.name)) {
      world.diagnostics.push(
        new Diagnostic(
          module.line, module.column,
          `module "${module.name}" is already declared in ${origin.get(module.name)}`,
          "error", path,
        ),
      );
      continue;
    }
    world.modules.set(module.name, module);
    origin.set(module.name, path);
  }

  return world;
}
