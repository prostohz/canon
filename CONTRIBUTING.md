# Working on canon

This is the repository of the language and its tools. For using canon in a
project of your own, see [`README.md`](README.md) — nothing here is needed
for that.

## The packages

    @canon/lang/    the definition of the language, the standard library
                    in stdlib/, and the tool: `canon`
    @canon/cli/     init, check, studio, vscode, version: `canon-cli`
    @canon/cli/studio/  the set in a browser: `canon-cli studio`
    @canon/cli/extension/  the editor extension, plain JavaScript, no build

Each npm package installs on its own — there is no workspace root.
`@canonspec/cli` depends on the language and includes Studio and the extension.

## Building and testing

    cd @canon/lang && npm install && npm test

A package that depends on another names its version, not its path, because
npm publishes a `file:` dependency exactly as it is written and a published
package would then point at a directory on the machine that published it.
To test changes to the packages beside it instead of published versions:

    cd @canon/cli
    npm run install:local     # npm install --no-save ../lang
    npm test

An ordinary `npm install` uses published dependencies once they exist.

What `canon-cli init` writes into a project — the workflow, the roles and the
skills — is Markdown in `@canon/cli/src/workflow`, not text inside a module.
`tsc` copies none of it, so `npm run build` copies it beside the compiled
modules afterwards; a `.md` edited without a build is an edit the tool does
not see.

## Checking the library and the examples

The standard library is checked like any other set, by naming its path:

    cd @canon/lang
    npm run check -- stdlib
    npm run check -- stdlib examples

From the root, the repository checks itself through its own manifest, which
names `@canonspec/lang` — the tool resolving the package this repository holds:

    node @canon/cli/dist/src/cli.js check

## Trying the tools without publishing

    cd @canon/cli && npm link       # a global canon-cli, live on the sources

Then `canon-cli init` in a project, or `npm link @canonspec/cli` inside one to
call it as `npx @canonspec/cli init`. Undo with `npm rm -g @canonspec/cli`.

## Changing the language

The definition lives in three documents that are normative together:
[`docs/language.md`](@canon/lang/docs/language.md) for the meaning of every
construct, [`docs/grammar.ebnf`](@canon/lang/docs/grammar.ebnf) for the
admissible order of tokens, and the prose of
[`docs/README.md`](@canon/lang/docs/README.md) for the idea.

- a change goes into every document it touches at once — a divergence
  between the prose, the grammar and the parser is a defect;
- a new construct is accepted only together with a check in the resolver,
  or with a note that it is not checked;
- a change comes with a test;
- the highlighting in `@canon/cli/extension/` repeats the list of keywords, and a
  test holds the two together: a word added to the lexer and forgotten
  there breaks the build.

The version of the format — the `language X.Y.Z` a module opens with — is
`VERSION` in `@canon/lang/src/version.ts`, and moves only when the grammar
does. The version of the package moves whenever anything ships.

## Changing the standard library

The rules a definition follows are in
[`@canon/lang/stdlib/README.md`](@canon/lang/stdlib/README.md). The library
is a vocabulary: it declares entities and holds no requirements. Adding a
module is a release of `@canonspec/lang`, not a change of the format.

## Publishing

Publish `@canonspec/lang` first, then `@canonspec/cli`: it names the language
version and cannot resolve it until it is there. Studio and the extension are
delivered in the CLI archive. The extension can be
packaged separately as a VSIX from `@canon/cli/extension/`.

The scoped packages say `publishConfig.access` in their manifests — npm
publishes a scoped package as restricted otherwise, and a restricted one
needs a paid plan. The `prepack` of each npm package copies the licence from
the root of the repository beside it.

## The language of the project

English: the specifications, the documentation and the messages of the tools.
