# Canon workflow

Canon specifications in `.canon/spec` are the normative description of the
project. Git holds their history. Do not create another workflow state or a
parallel copy of a specification.

The deterministic checker, not an agent's judgement, decides whether a Canon
set is structurally valid. Run `canon-cli check` after every specification
change and do not report success while it fails. Run it as the project
installs it — `npx canon-cli check` where it is a dependency — and do not
work around a checker that will not run.

The language is defined outside this project and is not guessed at from the
modules already written. `.canon/canon.toml` names the set: directories of
this project, and packages resolved wherever they were installed. Where a
package was found, and what it carries beside its modules, is not to be
worked out by hand — `canon-cli check` prints it under `read`:

- the modules themselves, the vocabulary the specifications are written
  against, indexed by a `README.md` of its own;
- `definition` — `language.md`, every construct and what stays prose, and
  `grammar.ebnf`, the admissible order of tokens;
- `examples` — whole sets written in the language, which are the shape a
  module takes and not a source of vocabulary or of requirements.

A path written into a specification, a skill or a note is a path to one
machine and wrong on the next. Ask the tool.

## The difference

Every stage but the first is scoped by one difference, and it is the same
difference for all of them: the working tree, uncommitted changes included,
against the merge base of the current branch with the default branch —
`git merge-base HEAD <default>`. Which files are Canon and which are code
follows from that one comparison, and a stage that needs a narrower scope
takes it from the person, not from a guess.

Work carried on the default branch itself has no such base. Ask the person
which commit the work starts from and do not invent one.

## The stages

Keep these stages separate:

1. specification — investigate the request and edit only the Canon set;
2. specification review — independently look for ambiguity, omissions and
   unsupported claims;
3. implementation — implement the accepted difference in the specification;
4. implementation review — independently compare the implementation with the
   specification, and judge it by nothing else.

The person starts the next stage. Writing a specification does not authorize
implementing it. Reviewers do not repair what they review unless the person
separately asks them to.

Use a fresh subagent for an independent review when the harness supports one.
If it does not, review in a fresh context and say that independence was not
available. Never treat an agent's own assertion as verification.

A fresh reviewer knows nothing of the conversation that produced the work.
Whoever calls one states the base of the difference, the files that changed
and the person's request as the person wrote it. A reviewer given none of
that asks for it rather than reconstructing it from the repository.

## Across sessions

A stage is one session's work, and no session begins knowing what the last
one meant. Nothing but the repository carries a stage to the next, so three
things are true of every stage.

**A stage ends in a commit of its own.** The specification is committed
without code, the implementation without specification. Whoever finishes a
stage offers that commit and makes it on the person's word — the commit is
where the person accepts the work, and nothing else records that they did.
It is also what tells an accepted difference from work abandoned halfway:
the next session reads `git log` and not the memory of a conversation.

**The stage is derived, not remembered.** From the difference: the Canon set
changed and no code did — what stands next is review of the specification,
or, once it is accepted, implementation; both changed and committed
separately — what stands next is review of the implementation; code changed
and the Canon set did not — the order has been broken, so stop and say so.
Where the difference leaves the stage genuinely undecided, ask the person.

**Nothing found survives only in the conversation.** By the end of a session
every finding of a review has reached one of three ends: fixed in the
specification, written into the specification as an assumption or an
exclusion, or put to the person and recorded in the body of the commit that
carries the difference. A finding still living in the chat is a finding
lost.
