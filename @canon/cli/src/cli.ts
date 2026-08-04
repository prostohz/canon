#!/usr/bin/env node
import { argv, exit } from "node:process";
import { resolve } from "node:path";

import {
  detectHarnesses,
  harnessIds,
  harnessTitle,
  hasHarness,
} from "./harness/index.js";
import { init } from "./init.js";

const USAGE = `canon-cli — the canon set in a project

usage:
  canon-cli init [directory] [--harness <id>] [--force]
  canon-cli check [paths...] [--strict]
  canon-cli studio [paths...] [--port <number>] [--no-browser]
  canon-cli vscode [--link] [--dir <directory>]
  canon-cli version

init creates .canon/spec and .canon/canon.toml, then detects or asks which local AI
harness the project uses and installs Canon skills for it. --harness makes that
choice non-interactively. Existing files are kept unless --force is given.

check reads the set and reports on it. With no paths named it takes them
from .canon/canon.toml — the manifest init writes. --strict treats warnings as
errors.

studio opens the set in a browser, through @canon/studio: the vocabulary,
the composition of entities together with what they inherit, requirements
with their references and links, and the diagnostics.

vscode lays the editor extension out where VS Code finds it, replacing
whatever earlier version is there. --link puts a symlink to the package
instead of a copy, for working on the extension itself; --dir names another
extensions directory, for the editors of the same family.
`;

const [command, ...rest] = argv.slice(2);

interface InitArguments {
  readonly force: boolean;
  readonly root: string;
  readonly harnesses: string[] | null;
}

class InitUsageError extends Error {}

const INTERACTIVE = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const COLOR = INTERACTIVE && process.env.NO_COLOR === undefined;

function paint(code: number, text: string): string {
  return COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;
}

const bold = (text: string): string => paint(1, text);
const dim = (text: string): string => paint(2, text);
const green = (text: string): string => paint(32, text);
const cyan = (text: string): string => paint(36, text);

function harnesses(value: string): string[] {
  if (!hasHarness(value)) {
    throw new InitUsageError(
      `--harness takes one of ${harnessIds().join(", ")}`,
    );
  }
  return [value];
}

function initArguments(args: string[]): InitArguments {
  let force = false;
  let root = ".";
  let namedRoot = false;
  let selected: string[] | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--force") {
      force = true;
    } else if (argument === "--harness") {
      const value = args[index + 1];
      if (value === undefined) throw new InitUsageError("--harness takes a value");
      selected = harnesses(value);
      index += 1;
    } else if (argument.startsWith("--harness=")) {
      selected = harnesses(argument.slice("--harness=".length));
    } else if (argument.startsWith("-")) {
      throw new InitUsageError(`unknown option: ${argument}`);
    } else if (namedRoot) {
      throw new InitUsageError(`init takes at most one directory`);
    } else {
      root = argument;
      namedRoot = true;
    }
  }
  return { force, root, harnesses: selected };
}

interface HarnessChoice {
  readonly id: string;
  readonly title: string;
  readonly detected: boolean;
}

async function navigateHarnesses(
  choices: readonly HarnessChoice[],
  initial: number,
): Promise<number | null> {
  const input = process.stdin;
  const output = process.stdout;
  const height = choices.length + 2;
  let selected = initial;
  let drawn = false;

  function render(): void {
    if (drawn) output.write(`\u001b[${height}A`);
    const lines = choices.map((choice, index) => {
      const cursor = index === selected ? cyan("›") : " ";
      const title = index === selected ? bold(choice.title) : choice.title;
      const found = choice.detected ? `  ${green("detected")}` : "";
      return `${cursor} ${title}${found}`;
    });
    lines.push("", dim("↑/↓ navigate  •  Enter select  •  Esc cancel"));
    for (const line of lines) output.write(`\r\u001b[2K${line}\n`);
    drawn = true;
  }

  render();
  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();
  output.write("\u001b[?25l");

  return await new Promise<number | null>((resolveChoice) => {
    function finish(choice: number | null): void {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\u001b[?25h");
      resolveChoice(choice);
    }

    function onData(chunk: Buffer | string): void {
      const key = chunk.toString();
      if (key === "\u001b[A") {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (key === "\u001b[B") {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key === "\r" || key === "\n") {
        finish(selected);
      } else if (key === "\u001b" || key === "\u0003") {
        finish(null);
      }
    }

    input.on("data", onData);
  });
}

async function askHarnesses(root: string): Promise<string[] | null> {
  const detected = await detectHarnesses(root);
  // A piped or automated init must never wait for input. Use an unambiguous
  // detected layout; otherwise the caller has to choose one explicitly.
  if (!INTERACTIVE) {
    if (detected.length === 1) return detected;
    if (!detected.length) {
      throw new InitUsageError("no AI harness detected; choose one with --harness");
    }
    throw new InitUsageError(
      `multiple AI harnesses detected (${detected.join(", ")}); choose one with --harness`,
    );
  }

  const supported = harnessIds();
  const choices: HarnessChoice[] = supported.map((id) => ({
    id, title: harnessTitle(id), detected: detected.includes(id),
  }));
  const fallback = detected.length ? supported.indexOf(detected[0]) : 0;
  console.log();
  console.log(bold("Canon"));
  console.log(dim("Set up specifications and a local AI workflow."));
  console.log();
  console.log(bold("Choose an AI harness"));
  const selected = await navigateHarnesses(choices, fallback);
  if (selected === null) return null;
  return [choices[selected].id];
}

function printInitResult(lines: string[], selected: string[]): void {
  if (!INTERACTIVE) {
    for (const line of lines) console.log(line);
    return;
  }

  const kept = lines.filter((line) => line.startsWith("kept")).length;
  console.log();
  console.log(`${green("✓")} Canon set is ready`);
  if (selected.length) {
    console.log(`${green("✓")} ${selected.map(harnessTitle).join(" and ")} workflow is ready`);
  } else {
    console.log(`${dim("–")} AI workflow skipped`);
  }
  if (kept) console.log(dim(`  ${kept} existing ${kept === 1 ? "file was" : "files were"} kept`));
  console.log();
  if (selected.includes("codex")) {
    console.log(`In Codex, start with ${cyan("$canon-spec <request>")}`);
  }
  if (selected.includes("claude")) {
    console.log(`In Claude Code, start with ${cyan("/canon-spec <request>")}`);
  }
  if (!selected.length) console.log(`Write specifications in ${cyan(".canon/spec")}.`);
  console.log();
}

if (command === "init") {
  try {
    const parsed = initArguments(rest);
    const root = resolve(parsed.root);
    const selected = parsed.harnesses ?? await askHarnesses(root);
    if (selected === null) {
      if (INTERACTIVE) console.log(`\n${dim("Setup cancelled.")}\n`);
    } else {
      const lines = await init({ root, force: parsed.force, harnesses: selected });
      printInitResult(lines, selected);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    exit(error instanceof InitUsageError ? 2 : 1);
  }
} else if (command === "check") {
  // Loaded only when asked for: checking drags in the language, and an init
  // has no use for it.
  const { ManifestError, UsageError, check, parseArguments } = await import("@canon/lang");
  try {
    exit(check(parseArguments(rest)));
  } catch (error) {
    if (error instanceof ManifestError || error instanceof UsageError) {
      console.error(error.message);
      exit(2);
    }
    throw error;
  }
} else if (command === "version" || command === "-v" || command === "--version") {
  const { versions } = await import("./version.js");
  for (const line of await versions()) console.log(line);
} else if (command === "vscode") {
  const link = rest.includes("--link");
  const at = rest.indexOf("--dir");
  const directory = at === -1 ? undefined : rest[at + 1];
  if (at !== -1 && directory === undefined) {
    console.error("--dir takes a directory");
    exit(2);
  }
  const { editor } = await import("./editor.js");
  try {
    for (const line of await editor({ directory, link })) {
      console.log(line);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    exit(1);
  }
} else if (command === "studio") {
  // The page and everything behind it are another package: this command is
  // the name it is reached by here, and nothing of it lives in this one.
  //
  // Serving outlives this line: the code goes into process.exitCode, not
  // into exit(), or the server would be shut down as it starts listening.
  const { main } = await import("@canon/studio");
  process.exitCode = main(rest);
} else if (command === undefined || command === "-h" || command === "--help") {
  console.log(USAGE);
} else {
  console.error(`unknown command: ${command}\n`);
  console.error(USAGE);
  exit(2);
}
