# Canon workflow

Canon specifications in `.canon/spec` are the normative description of the
project. Git holds their history. Do not create another workflow state or a
parallel copy of a specification.

The deterministic checker, not an agent's judgement, decides whether a Canon
set is structurally valid. Run `canon-cli check` after every specification
change and do not report success while it fails.

The language is defined outside this project and is not guessed at from the
modules already written. `.canon/canon.toml` names where it is read: `docs`
resolves to a directory holding `language.md`, every construct and what stays
prose, and `grammar.ebnf`, the admissible order of tokens; `stdlib` resolves
to the vocabulary the specifications are written against, indexed by a
`README.md` of its own. Each names a package or a directory, and a package is
read wherever it was installed.

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
