import { REVIEWERS, SKILLS, agentDocument, skillDocument } from "../workflow/index.js";
import type { Reviewer, Reviewers } from "../workflow/index.js";
import type { HarnessAdapter, ProjectWriter } from "./types.js";

const NAMES: Reviewers = {
  "spec-reviewer": "canon_spec_reviewer",
  "implementation-reviewer": "canon_implementation_reviewer",
};

const DESCRIPTIONS: Reviewers = {
  "spec-reviewer": "Independently reviews changed Canon specifications after the author has finished.",
  "implementation-reviewer": "Independently compares implementation and tests with changed Canon requirements.",
};

async function installReviewer(project: ProjectWriter, reviewer: Reviewer): Promise<void> {
  await project.write(`.codex/agents/canon-${reviewer}.toml`, `name = "${NAMES[reviewer]}"
description = "${DESCRIPTIONS[reviewer]}"
sandbox_mode = "read-only"

developer_instructions = """
${agentDocument(reviewer)}
"""
`);
}

export const codex: HarnessAdapter = {
  id: "codex",
  title: "Codex",
  signals: ["AGENTS.md", ".agents", ".codex"],
  async install(project): Promise<void> {
    for (const [name, delegates] of Object.entries(SKILLS)) {
      await project.write(`.agents/skills/${name}/SKILL.md`, skillDocument(name, delegates, NAMES));
    }
    for (const reviewer of REVIEWERS) await installReviewer(project, reviewer);
  },
};
