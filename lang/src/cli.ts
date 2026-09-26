import { Diagnostic, ERROR, WARNING } from "./errors.js";
import { ManifestError, discover } from "./manifest.js";
import type { Source } from "./manifest.js";
import { resolve } from "./resolver.js";
import { World, load, replaced } from "./world.js";

export const USAGE = `canon — checking specifications

usage:
  canon check [paths...] [--strict]

With no paths named, the set is taken from .canon/canon.toml — the manifest found
in the current directory or above it. --strict treats warnings as errors.
`;

export class UsageError extends Error {}

function percent(part: number, whole: number): string {
  return whole ? `(${Math.round((100 * part) / whole)}%)` : "(—)";
}

function section(title: string, items: string[]): void {
  console.log(`${title} (${items.length})`);
  for (const item of items) console.log(`  ${item}`);
  console.log();
}

function row(title: string, count: number): string {
  return `  ${title.padEnd(16)}${String(count).padStart(5)}`;
}

/**
 * Where the set was read from, resolved. A package is named in the manifest
 * and found wherever it was installed; whoever needs the definition of the
 * language or an example of a set written in it is told the place instead of
 * looking for it.
 */
function read(sources: Source[]): void {
  console.log("read");
  for (const source of sources) {
    console.log(`  ${source.named.padEnd(20)}${source.path}`);
    if (source.docs !== null) console.log(`    definition        ${source.docs}`);
    if (source.examples !== null) console.log(`    examples          ${source.examples}`);
  }
  console.log();
}

function report(world: World, diagnostics: Diagnostic[]): void {
  const errors = diagnostics.filter((item) => item.severity === ERROR);
  const warnings = diagnostics.filter((item) => item.severity === WARNING);

  if (errors.length) section("errors", errors.map((item) => item.format()));
  if (warnings.length) section("warnings", warnings.map((item) => item.format()));

  const modules = [...world.modules.values()];
  const named = modules.flatMap((module) => module.named);
  const composed = named.filter((node) => node.kind === "entity" && node.parts.length);
  // What is counted is what is in force: a replaced requirement is no longer
  // among what has to be met, and counting it would overstate the work.
  const retired = replaced(world);
  const written = modules.flatMap((module) => module.requirements);
  const requirements = written.filter((node) => !retired.has(node.label));
  const exclusions = modules.flatMap((module) => module.ofKind("exclude"));
  const justified = requirements.filter((node) => node.because !== null);
  const dead = warnings.filter((item) => item.message.includes("mentioned nowhere"));

  const total = requirements.length;
  console.log("summary");
  console.log(row("modules", world.modules.size));
  console.log(`${row("entities", named.length)},  composed ${composed.length}`);
  console.log(
    `${row("requirements", total)},  replaced ${written.length - total}`);
  console.log(row("exclusions", exclusions.length));
  console.log(
    `${row("justified", justified.length)} of ${total}`
    + `  ${percent(justified.length, total)}`,
  );
  console.log(row("dead entities", dead.length));
}

export interface Arguments {
  paths: string[];
  strict: boolean;
}

export function parseArguments(argv: string[]): Arguments {
  const args: Arguments = { paths: [], strict: false };
  for (const argument of argv) {
    if (argument === "--strict") args.strict = true;
    else if (argument.startsWith("-")) {
      throw new UsageError(`unknown option: ${argument}`);
    } else args.paths.push(argument);
  }
  return args;
}

export function check(args: Arguments): number {
  let { paths } = args;
  let sources: Source[] = [];
  if (!paths.length) {
    // The vocabulary is checked with the specifications written against it:
    // a name that does not resolve is an error wherever the name was
    // declared, and the set is not the set without it.
    const manifest = discover();
    sources = manifest.sources;
    paths = manifest.paths;
  }

  const world = load(paths);
  const diagnostics = [...world.diagnostics, ...resolve(world)];

  diagnostics.sort((one, other) =>
    Number(one.severity !== ERROR) - Number(other.severity !== ERROR)
    || (one.path < other.path ? -1 : one.path > other.path ? 1 : 0)
    || one.line - other.line || one.column - other.column);
  if (sources.length) read(sources);
  report(world, diagnostics);

  if (diagnostics.some((item) => item.severity === ERROR)) return 1;
  if (args.strict && diagnostics.length) return 1;
  return 0;
}

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === undefined) {
    console.log(USAGE);
    return 2;
  }
  if (command === "-h" || command === "--help") {
    console.log(USAGE);
    return 0;
  }
  if (command !== "check") {
    console.error(`unknown command: ${command}\n`);
    console.error(USAGE);
    return 2;
  }
  try {
    return check(parseArguments(rest));
  } catch (error) {
    if (error instanceof ManifestError || error instanceof UsageError) {
      console.log(error.message);
      return 2;
    }
    throw error;
  }
}
