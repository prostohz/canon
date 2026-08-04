import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { installHarnesses } from "./harness/index.js";

// The package a set is written against by default: the language carries its
// definition and the vocabulary written in it, released together under one
// version. A project that speaks its own vocabulary names its own package
// here instead — nothing about the tool prefers this one.
export const SOURCE = "@canon/lang";

export const MANIFEST = `# The set: what is checked as one delivery.

# The vocabulary the specifications are written against. A package, resolved
# where it was installed — beside the project or globally — or a path,
# written as one. Name your own here to speak your own vocabulary.
stdlib = "${SOURCE}"

# The definition of the language, for whoever reads or writes a
# specification. Nothing is checked against it: it is prose.
docs = "${SOURCE}"

# What this project writes itself.
paths = [
    "spec",
]
`;

const SPEC_README = `# Specifications

The \`.canon\` modules of this project live here: the vocabulary it declares
and the requirements it states. The standard library is not beside them —
the manifest names it as a package, wherever it was installed, and a
\`uses\` line refers to a module of it by name.

That is also how the language is updated: by updating the package. Nothing
here is a copy, and there is nothing to fall out of step.
`;

export interface InitOptions {
  root?: string;
  force?: boolean;
  /** Local AI harnesses whose project discovery layouts are to be installed. */
  harnesses?: readonly string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function init(
  { root = ".", force = false, harnesses = [] }: InitOptions = {},
): Promise<string[]> {
  const base = resolve(root);
  const canon = join(base, ".canon");
  const done: string[] = [];

  const spec = join(canon, "spec");
  if (await exists(spec)) {
    done.push("kept      .canon/spec");
  } else {
    await mkdir(spec, { recursive: true });
    await writeFile(join(spec, "README.md"), SPEC_README, "utf8");
    done.push("created   .canon/spec");
  }

  const file = join(canon, "canon.toml");
  if ((await exists(file)) && !force) {
    done.push("kept      .canon/canon.toml (--force to replace it)");
  } else {
    await writeFile(file, MANIFEST, "utf8");
    done.push("wrote     .canon/canon.toml");
    done.push(`named     ${SOURCE}`);
  }

  done.push(...await installHarnesses(base, harnesses, force));

  return done;
}
