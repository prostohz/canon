# The VS Code extension

Highlighting, navigation and hints for the [`.canon`](../../lang/docs/README.md)
format.

## What it does

**Highlighting** — a TextMate grammar,
[`syntaxes/canon.tmLanguage.json`](syntaxes/canon.tmLanguage.json). The
seventeen keywords, the signs and the token classes. The blocks `means`,
`states` and `because` get a scope of their own and read as prose, not as
code; references inside them are highlighted separately — there they are
the only thing that is significant.

A block of prose is marked up by a `begin`/`while` rule with a back
reference to the indentation of the heading: the highlighting ends where
the block ends for the lexer.

**References** are coloured by their parts, since that is where the whole of
what is formal in prose sits: the module qualifying the name, the name, the
name given here after `#`, the part or the value of an enum after `.`, and
the caption apart from all of them — the address is what the tool answers
for, the caption a word of the sentence. A break inside a reference is
allowed, so the caption is a region rather than a part of the match:

    [delivery-address|delivery
    address]

Each part of the address carries two scopes — a general one and the canon
one, in that order. A theme that knows the second colours by it; a theme
that knows neither falls back to the first instead of to the colour of the
prose around it, which is the whole of what a reference has to be told
apart from. Without the pair, `Dark (Visual Studio)` and its like — which
colour keywords and strings and nothing else — show a block of prose in one
colour, references and all.

Two limits, and neither is a defect. A name introduced in the text and used
alone — `[source|it]` — is written like a declared name and is coloured like
one: which it is stands a line or two above, and the grammar does not read
that far. And `[order]`, an address with no caption, is not the shape of a
reference, so it stays prose — that it should have been one is `canon
check`'s to say.

**Go to definition** — from an address in the text and from the type of a
part to the right of the colon. An address holding a member holds two
places, and each piece leads to its own: in
`[transfer-state.settled|settled]` the name leads to the declaration of
`transfer-state` and the member to the line of `settled`. An inherited part
leads to the declaration, since the scan of the editor resolves no
supertypes. A name introduced in the text itself — `[source.order-state]` —
leads nowhere: what it stands for is written a line or two above, and the
scan does not read prose. Neither does the caption lead anywhere: it is a
word of the sentence, and the address beside it is what is addressed.

The link is offered over the piece of the address under the cursor, so the
underline shows which of the two is about to be followed.

**Hover** — the shape of the declaration, its composition and the text of
`means`, over the same pieces.

**Completion** — on `[` inside a block of prose it offers entities, after a
colon types. An own name short, a foreign one qualified. Labels are offered
nowhere: prose refers to no labels.

**Document outline** — declarations and requirements as a list, parts
nested; symbol navigation and breadcrumbs work.

## What it does not do

It does not check: an unresolved reference, an undeclared type and a
duplicated label will not be highlighted. The checks live in `canon check`,
and repeating them with regular expressions would mean a second set of
rules that drifts apart from the first.

Hence the natural next step — a language server on top of the same checking
code; then the diagnostics appear in the editor without a second
implementation.

## Installing

This directory is a ready extension with no build step. It is included in
`@canonspec/cli`, which lays it out with:

    canon-cli vscode

It writes `canonspec.canonspec-vscode-<version>` into `~/.vscode/extensions`,
removing whatever version was there. `--dir` names another extensions
directory, for the editors of the same family; `--link` puts a symlink to
this directory instead of a copy — that is the way to work on the extension
itself, since an edit is then seen without a second install.

Restart the editor afterwards: the directory is scanned at start-up. A file
is recognised by the `.canon` extension and by a first line such as
`language 0.1.0`.

The VS Code identifier is `canonspec.canonspec-vscode`:
`publisher.name` in `package.json`. `displayName` is Canon.

To build a VSIX, run from this directory:

    npx @vscode/vsce package --no-dependencies

The same manifest can be published to the VS Code Marketplace once the
publisher `canonspec` exists. The extension is not a separate npm package.

## Contents

- [`package.json`](package.json) — the declaration of the language and the
  grammar;
- [`syntaxes/canon.tmLanguage.json`](syntaxes/canon.tmLanguage.json) — the
  highlighting;
- [`language-configuration.json`](language-configuration.json) — comments,
  brackets, indentation, folding by indentation;
- [`canon.js`](canon.js) — parsing exactly as far as the editor needs;
- [`extension.js`](extension.js) — the providers of navigation, hover,
  completion and outline.

## Staying in step

Two tests in [`@canon/lang/test`](../../lang/test/specs.test.ts) hold the
highlighting to the language, and both are deliberately mechanical: "the
highlighting lists every keyword" — a word added to the lexer and not added
here breaks the build; "the highlighting knows every form of an address" —
the reference rule is run over the forms an address takes and must accept
exactly those the parser accepts. Beyond them the extension and the parser
share nothing.
