import { PREAMBLE, prose } from "./document.js";

/**
 * A reviewer a harness installs as an agent of its own. Its brief is written
 * in `agents/`, one file to a name here: a harness installs it verbatim,
 * under a name of its own, and adds nothing.
 */
export type Reviewer = "spec-reviewer" | "implementation-reviewer";

export const REVIEWERS: readonly Reviewer[] = ["spec-reviewer", "implementation-reviewer"];

/** What a harness calls each reviewer it installs. */
export type Reviewers = Readonly<Record<Reviewer, string>>;

/** A reviewer reads its brief as its whole instruction. */
export function agentDocument(reviewer: Reviewer): string {
  return `${PREAMBLE}\n\n${prose(`./agents/${reviewer}.md`)}`;
}
