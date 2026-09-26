# The language

The definition of canon and the tool reading it. The tool takes a set of
`.canon` files, checks them and prints a report; it proves nothing and does
not judge whether the requirements are right.

    docs/          the definition of the language: grammar and prose
    stdlib/        the standard library: the vocabulary written in it
    examples/      a specification and a vocabulary, kept as demonstrations
    src/  test/    the tool

The definition and the vocabulary are one delivery and go out under one
version: a word added to the library is a release of this package, and the
version of the format the modules are written in — the first line of every
one of them — is a separate number, which moves only when the grammar does.

    npm install       # installs typescript and builds the tool
    npm test
    npm run check -- stdlib

With no paths named, the set is taken from `.canon/canon.toml` — the manifest
found in the current project or one above it, naming the vocabulary the
specifications are written against and the directories the project writes
itself. Its paths are relative to `.canon`. This repository holds one there
for what canon says about itself; the checks above name their paths outright
and never reach it.

A manifest names the vocabulary as a package or as a path, and a package it
resolves where whoever installed it put it — beside the project or globally
beside the tool.

    npm run check -- stdlib ../../../specs

The command itself is `canon`; the package declares it as its `bin`, so a
project that depends on `@canonspec/lang` calls it as `npx canon check`.

`--strict` treats warnings as errors.

## What is checked

**Errors** — parsing the file; the module name matching the file name;
uniqueness of the module name and of a name inside a module; resolvability
of a supertype, of the type of a part and of a reference; the member of a
reference being a part of that entity or a value of that enum; an address
carrying a caption; a name
introduced in a text standing once, repeating no declared name and
introduced before it is used; a text that names things of a type not
addressing that type as a thing; no cycle in the chain of supertypes; uniqueness of the name of a part and the ban on overriding an
inherited one; the ban on `thing` in the position of the type of a part;
uniqueness of the values of an enum; the module being listed in `uses`;
uniqueness of a label; the label of a link being carried by a statement of
the set; no cycle in the chain of `replaces`; the label of `given` being
carried by an assumption.

**Warnings** — an entity nothing refers to; a requirement without
references; a requirement or an exclusion without `because`; a `means`
shorter than forty characters; an entity with a composition that no
requirement speaks about; a labelled assumption nothing leans on.

An exclusion (`exclude`) does not count as a requirement: it cannot be
implemented, and it is not counted among them.

Dead names are looked for only in modules that hold requirements: a module
without them is a vocabulary, and its entities are introduced for other
specifications.

## Structure

TypeScript, compiled by `tsc` into `dist/`; the package is `@canonspec/lang` and
its command is `canon`.

- `src/lexer.ts` — tokens and indentation; a block of free text is read
  whole;
- `src/parser.ts` — recursive descent, one token of lookahead;
- `src/nodes.ts` — nodes and the parsing of references inside prose;
- `src/manifest.ts` — reading the manifest naming the paths of a set;
- `src/world.ts` — gathering files into a set of modules;
- `src/resolver.ts` — every check from the list above;
- `src/cli.ts` — the report and the summary; `src/bin.ts` runs it;
- `src/index.ts` — what the package offers to whoever reads a set: the
  check itself among the rest, so that `@canonspec/cli` may carry the same
  command without repeating it.

## What is not here

Nothing reads source code: a check reports on the specifications and on
nothing else.

Nothing judges the requirements themselves. Finding where two of them
contradict each other is planned; deciding whether one is right to have
been asked for is out of scope.

## Tests

`test/specs.test.ts` covers the lexer, the parsing of every construct,
every check of the resolver, and the manifest. Separately it checks that the
list of keywords is the same in three places: the lexer,
[`docs/grammar.ebnf`](docs/grammar.ebnf) and the highlighting grammar in
[`@canon/cli/extension/`](../cli/extension/README.md). A word added in one place and forgotten
in another breaks the build.

`test/profile/toolkit.canon` — a small profile on top of the vocabulary;
it is parsed together with the library.
