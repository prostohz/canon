import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { WORKFLOW, WORKFLOW_PATH } from "../workflow/index.js";
import { claude } from "./claude.js";
import { codex } from "./codex.js";
import type { HarnessAdapter, ProjectWriter } from "./types.js";

// Adding a harness means implementing HarnessAdapter in its own module and
// registering it here. Detection, prompting, init and shared workflow files
// do not otherwise change.
const ADAPTERS: readonly HarnessAdapter[] = [codex, claude];
const BY_ID = new Map(ADAPTERS.map((adapter) => [adapter.id, adapter]));

export function harnessIds(): string[] {
  return ADAPTERS.map((adapter) => adapter.id);
}

export function harnessTitle(id: string): string {
  return BY_ID.get(id)?.title ?? id;
}

export function hasHarness(id: string): boolean {
  return BY_ID.has(id);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Harnesses already named by conventional project files. */
export async function detectHarnesses(root: string): Promise<string[]> {
  const detected = await Promise.all(ADAPTERS.map(async (adapter) => ({
    adapter,
    found: (await Promise.all(
      adapter.signals.map(async (signal) => await exists(join(root, signal))),
    )).some(Boolean),
  })));
  return detected.filter((item) => item.found).map((item) => item.adapter.id);
}

class Writer implements ProjectWriter {
  readonly done: string[] = [];

  constructor(private readonly root: string, private readonly force: boolean) {}

  async write(path: string, content: string): Promise<void> {
    const target = join(this.root, path);
    if ((await exists(target)) && !this.force) {
      this.done.push(`kept      ${path}`);
      return;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    this.done.push(`wrote     ${path}`);
  }
}

/**
 * Write the workflow, and each selected harness's discovery layout naming
 * it. The workflow is one file however many harnesses read it.
 */
export async function installHarnesses(
  root: string,
  selected: readonly string[],
  force: boolean,
): Promise<string[]> {
  if (!selected.length) return [];
  const adapters = [...new Set(selected)].map((id) => {
    const adapter = BY_ID.get(id);
    if (adapter === undefined) throw new Error(`unknown AI harness: ${id}`);
    return adapter;
  });
  const project = new Writer(root, force);

  await project.write(WORKFLOW_PATH, WORKFLOW);
  for (const adapter of adapters) await adapter.install(project);

  return project.done;
}

export type { HarnessAdapter, ProjectWriter } from "./types.js";
