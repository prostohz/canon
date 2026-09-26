/**
 * The workflow a project installs: the document naming its stages, the skills
 * a harness offers those stages through, and the reviewer agents the skills
 * hand their work to. A harness reaches all of it by this module.
 */

export { GENERATED, WORKFLOW, WORKFLOW_PATH } from "./document.js";
export { REVIEWERS, agentDocument } from "./agents.js";
export type { Reviewer, Reviewers } from "./agents.js";
export { SKILLS, skillDocument } from "./skills.js";
