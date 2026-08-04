import { GENERATED, REVIEWERS, SKILLS, agentDocument, skillDocument } from "../workflow/index.js";
import type { Reviewer, Reviewers } from "../workflow/index.js";
import type { HarnessAdapter, ProjectWriter } from "./types.js";

const NAMES: Reviewers = {
  "spec-reviewer": "canon-spec-reviewer",
  "implementation-reviewer": "canon-implementation-reviewer",
};

const DESCRIPTIONS: Reviewers = {
  "spec-reviewer": "Independently reviews changed Canon specifications. Use after a specification author has finished.",
  "implementation-reviewer": "Independently compares implementation and tests with changed Canon requirements. Use after implementation.",
};

async function installReviewer(project: ProjectWriter, reviewer: Reviewer): Promise<void> {
  const name = NAMES[reviewer];
  await project.write(`.claude/agents/${name}.md`, `---
name: ${name}
description: ${DESCRIPTIONS[reviewer]}
tools: Read, Glob, Grep, Bash
model: inherit
---

${GENERATED}
${agentDocument(reviewer)}
`);
}

export const claude: HarnessAdapter = {
  id: "claude",
  title: "Claude Code",
  signals: ["CLAUDE.md", ".claude"],
  async install(project): Promise<void> {
    for (const [name, delegates] of Object.entries(SKILLS)) {
      await project.write(`.claude/skills/${name}/SKILL.md`, skillDocument(name, delegates, NAMES));
    }
    for (const reviewer of REVIEWERS) await installReviewer(project, reviewer);
  },
};
