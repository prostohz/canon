# @canon/studio

A canon set in a browser: the vocabulary, the requirements and their links,
as the tool sees them.

    npm install -g @canon/studio

    canon-studio [paths...] [--port <number>] [--no-browser]

The same page is opened by `canon-cli studio`, which loads this package and
holds nothing of it. Either way the set is taken from `.canon/canon.toml` when no
paths are named — the same manifest `canon check` reads.

## What it shows

- **On the left** — the modules, split into specifications (those that hold
  requirements) and vocabularies. A dot by a name means an error in the
  module.
- **The vocabulary of a module** — a card per entity: supertype,
  composition, multiplicities, flags, the values of an enum, the base of a
  value and the text of `means`.
- **Inherited parts** are shown in the same composition, muted, with a note
  of the entity they came from. This is the only place the full composition
  is visible: the text of the file does not hold it.
- **Requirements** — the text, the rationale, the obligation; references are
  clickable and lead to the definition, in another module as well.
- **The links of a statement** — what it replaces and what it leans on, and
  the other end of both: what replaced it, and what leans on it. The second
  pair is held by no file, since a link is written on the statement that came
  second. A replaced statement is shown struck through and out of force, and
  stays where it was written.
- **Outside the scope** — the exclusions as a separate section, dashed: what
  was declined and why.
- **Back references** — under every entity, the requirements that mention it.
- **The diagnostics** of a module — errors and warnings as a list, with their
  place.

## It holds no rules of its own

The set is parsed and checked through [`@canon/lang`](../lang/README.md), so
there is nothing here for the tool to drift apart from. What this package
adds is the arrangement: walking the chain of supertypes so that inherited
parts can be shown beside the own ones, collecting the back references, and
laying the diagnostics out by module — all of it derived, none of it stored.

The page reads one address, `/api/world`, and is re-read from the files on
every request: a set edited in the editor is a reload away.

## Contents

TypeScript, compiled by `tsc` into `dist/`; the page beside it, with no
build step and no external dependencies.

- [`src/server.ts`](src/server.ts) — HTTP and two responses: the page and
  `/api/world`;
- [`src/model.ts`](src/model.ts) — turning the parsed set into JSON;
- [`public/index.html`](public/index.html) — the whole page;
- [`test/studio.test.ts`](test/studio.test.ts) — what the model puts
  together.

    npm install
    npm test

In a checkout of the repository `@canon/lang` is not on the registry yet:

    npm run install:local   # npm install --no-save ../lang

## Licence

MIT, the licence of the repository this package is built from.
