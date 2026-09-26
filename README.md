# Canon Spec

A language for describing requirements, and its tools: a modular vocabulary
of entities, the composition of records, and requirements in prose with
references to the entities.

    @canon/cli/     the npm package laying a set out and naming the rest
    @canon/lang/    the language: its definition, its vocabulary, its tool
    @canon/cli/studio/  the set in a browser, included in the CLI
    @canon/cli/extension/  the editor extension, included in the CLI

## What is formal and what is prose

What is described formally is what an implementer builds the data schema
from: which entities exist, what is made of what, how many parts there are,
which values are admissible. Requirements, constraints, deadlines and
behaviour are prose with references.

Precision rests on **vocabulary discipline**: you may speak only of what
has been declared somewhere, and a reference to an undeclared entity does
not pass the check. A requirement carries a label, unique across the set,
by which it is referred to.

Planned, not implemented: finding where two requirements contradict each
other, and generating from a requirement the tests that would show it met.

What the language does not give, now or later: it does not judge whether a
requirement is right — whether it should have been asked for at all — and
it does not decide the architecture of an implementation.

## Example

    language 0.1.0
    module orders
      uses core, data
      means
        Placing and attending to the orders of a buyer.

    entity order : data:record
      order-number : order-number
      state        : order-state
      address      : delivery-address optional
      means
        order: a confirmed intention to buy a set of lines.

    value order-number : core:text

    enum order-state
      draft
      placed
      shipped

    requirement R-014
      states
        An [order|order] in the state `placed` must have a
        [delivery-address|delivery address].
      because
        An order without an address cannot be delivered.

## Getting started

In a project of your own, in whatever language it is written:

    npm install -g @canonspec/cli

    canon-cli init
    canon-cli check

`init` writes `.canon/spec`, for the specifications of the project, and
`.canon/canon.toml`, the manifest naming the set:

    paths = [
        "@canonspec/lang",
        "./spec",
    ]

It also detects or asks whether the project uses Codex or Claude Code, and
lays out the Canon specification, implementation and review skills where the
selected harness discovers them. The choice can be given explicitly with
`--harness codex` or `--harness claude`.

Nothing of the language is copied into the project. A name that is not
written as a path is the name of a package, resolved where whoever
installed it put it — beside the project or globally beside the tool — so
the manifest carries nothing of the machine it was written on, and a
project needs no `node_modules` of its own. The package is asked what it
holds, so one name brings the vocabulary, the definition of the language and
the examples at once, and `canon-cli check` prints where each resolved. Name
your own package in the list to speak your own vocabulary; the language is
updated by updating the package.

A set may also be named on the command line, path by path, and then the
manifest is not consulted at all.

The definition of the language is in
[`@canon/lang/docs/`](@canon/lang/docs/README.md); the commands, in
[`@canon/cli/README.md`](@canon/cli/README.md). Working on canon itself —
building the packages, changing the language — is
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licence

[MIT](LICENSE). It covers the language, the standard library and the tools,
and travels with them in the packages they go out in — a specification
written in canon is the work of whoever writes it.
