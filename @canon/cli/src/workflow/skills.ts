import type { Reviewer, Reviewers } from "./agents.js";
import { GENERATED, PREAMBLE, prose } from "./document.js";

/**
 * A stage of the workflow as a harness offers it. What a skill says is in
 * `skills/`, one file to a name here; what stands here is the graph — which
 * reviewer it hands its work to, if any.
 */
export const SKILLS: Readonly<Record<string, Reviewer | null>> = {
  "canon-spec": "spec-reviewer",
  "canon-implement": null,
  "canon-review": "implementation-reviewer",
};

/** The one line a harness matches a request against, and the rest of the text. */
function parse(name: string): { description: string; body: string } {
  const found = /^---\ndescription: (.+)\n---\n\n([\s\S]+)$/.exec(prose(`./skills/${name}.md`));
  if (found === null) {
    throw new Error(`${name}.md must open with a description, then a blank line`);
  }
  return { description: found[1], body: found[2] };
}

/**
 * The reviewer named as this harness installed it. Without the name a skill
 * asks for "a fresh subagent" and gets an unprepared one.
 */
function named(document: string, delegates: Reviewer | null, reviewers: Reviewers): string {
  const resolved = delegates === null
    ? document
    : document.replaceAll("{reviewer}", reviewers[delegates]);
  if (resolved.includes("{reviewer}")) {
    throw new Error("a skill names {reviewer} and delegates to no reviewer");
  }
  return resolved;
}

export function skillDocument(
  name: string,
  delegates: Reviewer | null,
  reviewers: Reviewers,
): string {
  const { description, body } = parse(name);
  return named(`---
name: ${name}
description: ${description}
---

${GENERATED}
${PREAMBLE}

${body}
`, delegates, reviewers);
}
