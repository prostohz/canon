# Project Instructions

## The goal

canon is a system for managing formal requirements.

The problem: textual specifications in Markdown are pleasant to read but
work badly as the source an implementation is built from. Entities are
named however they happen to be named, the composition of the data has to
be guessed, and the same thing is called two things in two paragraphs
without anyone noticing.

Requirements are written down semi-formally: the vocabulary and the
composition of entities are formal, the requirements themselves are prose
referring to them. The tool keeps one property — **vocabulary discipline**:
a reference to an entity declared nowhere does not pass the check. A
requirement carries a label, unique across the set, by which it is referred
to. That is what is implemented.

The tool does not read source code, and holds no correspondence between a
requirement and anything implementing it.

Planned, not implemented:

- **consistency between requirements** — finding where two contradict each
  other;
- **tests generated from requirements** — a requirement yielding the
  checks that would show it met.

Out of scope, now and later: canon does not judge whether a requirement is
right to have been asked for, and does not decide the architecture of an
implementation. A proposal is judged by the property above and by the two
planned ones, and must not step outside those bounds.

## Who the specification is for

The specification is written by an AI agent, from the definition of the
language; a human reviews it; the implementation of an accepted
specification is again carried out by an AI agent. In that circle the human
is a reviewer, not the main reader.

It follows that:

- **the structure must be unambiguous**: from the composition of an entity
  two agents must build the same data schema;
- **prose stays prose**: agents read it well, and pretending that the text
  of a requirement is formal means introducing a divergence between the
  ordinary reading and the normative one;
- **a requirement is named**: its label is stable, so that a reviewer, an
  agent and a later requirement can all refer to the same thing.

## The state of the repository

The canon language is defined, implemented and covered by tests; the
vocabulary is written in it. There are no actions, invariants or time in
the language — a deliberate bound, see `@canon/lang/docs/language.md`.

    @canon/cli/     the npm package laying a set out and naming the rest
    @canon/lang/    the language: its definition, its vocabulary, its tool
    @canon/cli/studio/  the set in a browser
    @canon/cli/extension/  the editor extension

Everything executable is TypeScript on Node, except the extension, which is
plain JavaScript with no build step. Two npm packages, each installed on
its own — `@canonspec/cli` depends on `@canonspec/lang` and includes Studio
and the extension. Their source directories live under `@canon/`. There is
no workspace root and no Python.

Two packages are prepared for npm: `@canonspec/lang` (the definition, the standard
library in `stdlib/`, and the tool as the `canon` command) and `@canonspec/cli`
(`init`, `check`, `studio`, `vscode` and the extension).
Their previous `0.1.0` versions were unpublished;
the next release must use a new version.

The library goes out inside the language and under its version: one
delivery, nothing to keep in step by hand. That version is not the version
of the format — the `language X.Y.Z` every module opens with, checked
against `VERSION` in `src/version.ts` and moved only when the grammar
moves. Adding a word to the library is a release; it is not a change of
format, and no specification anywhere rewrites its first line for it.

The repository uses `@canon/` for source directories and `@canonspec` for npm
package names. The scoped packages say `publishConfig.access` outright: a
scoped package is restricted unless it says otherwise, and a restricted one
is not free.

The extension has its own manifest at `@canon/cli/extension/package.json`
for a future VSIX or Marketplace release. Its identifier is
`canonspec.canonspec-vscode`; it is not a separate npm package.

Because npm publishes `file:` dependencies as they are written, `@canonspec/cli`
names the version of the language, not its path, and takes it from
beside itself in a checkout — `npm run install:local`.

**Nothing of the language is copied into a project.** An init writes
`.canon/spec` and a manifest whose one list names the package `@canonspec/lang`
beside the project's own directories — never a path to it. The package
answers for what it holds: its `canon` field says where in it the modules,
the definition and the examples lie, so the set names it once and the tool
prints where each resolved. A project may name its own package instead and
speak its own vocabulary; `@canon/cli/README.md` has the shape of the
manifest and the rules of resolution, `src/manifest.ts` implements them.
In a project initialized by the CLI, `.canon/canon.toml` names `@canonspec/lang`.

The price of it, taken knowingly: a specification cannot be resolved
without the package declaring its vocabulary, and a global install records
nowhere which version that was. A project wanting the version recorded
installs into itself, where the lock file holds it.

## The specification language

The language is defined in `@canon/lang/docs/` and is not retold here:

- `README.md` — the idea and the relation to earlier versions;
- `language.md` — every construct and what stays prose;
- `grammar.ebnf` — the collected grammar, LL(1).

The documents are normative together: `grammar.ebnf` sets the admissible
order of tokens, the prose the meaning of the constructs. A change goes
into every document it touches at once — a divergence between the prose,
the grammar and the parser is a defect — and comes with a test and with a
check in the resolver, or with a note that it is not checked.
`CONTRIBUTING.md` says the same to a contributor, at greater length.

## The standard library

The modules of the library set the entities the specifications operate on.
The index of the modules and the rules a definition follows are in
`@canon/lang/stdlib/README.md`, and are not repeated here; how it is
written down is in `@canon/lang/docs/language.md`.

The one thing to hold on to while changing it: the library is a vocabulary
and holds no requirements.

## The tools

Building, testing, checking the library and publishing are in
`CONTRIBUTING.md`, and are not repeated here.

The tool checks the structure and the resolvability of names; it proves
nothing. Sources in `@canon/lang/src`, tests in `@canon/lang/test`; what
the package offers to other packages is listed in `src/index.ts`.

`@canonspec/cli` carries `init`, `check`, `studio`, `vscode` and `version`, each
described in its README and loaded only when asked for, so that `init` pays
for none of the rest. Two rules hold across it: it writes no copy of
anything but the extension, and that into the editor, not the project; and
it names packages rather than resolving them into paths, so that what it
writes down travels to another machine. It holds no rules of its own at all
— checking is the language, Studio and the extension are bundled with the CLI,
and what is here is the layout of a set in a project and the names those tools
are reached by.

Studio is the set in a browser, served at `/` with one address
behind it, `/api/world`, re-read from the files on every request. It holds
no rules either: it parses through `@canonspec/lang` and only arranges what
comes back — the chain of supertypes walked so that inherited parts show
beside the own ones, the back references collected, the diagnostics laid out
by module. Nothing of it is stored.

The language of the project is English: the specifications, the
documentation, and the messages of the tools. Do not add code comments.
