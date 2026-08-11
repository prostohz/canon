# Examples

Written to show what a set looks like when it is not the standard library.
They are demonstrations, nothing depends on them, and they are not part of
any delivery — nothing is checked against what stands here.

They do go out with the package, and a project reaches them without naming
them: `package.json` says `"canon": { "examples": "examples" }`, so a set
holding `@canon/lang` holds the way here too, and `canon-cli check` prints
it. What is read from them is the shape a module takes — never vocabulary,
which the standard library carries, and never requirements, which belong to
the project reading them.

Every file is a module of the [canon](../docs/README.md) language; the file
name matches the module name. The directories mean nothing to the tool,
which knows a module by its name and not by its place.

## A specification

- [`transfers`](specs/transfers.canon) — moving money between the accounts a
  bank keeps: what an account is, what a transfer is made of, what a
  statement tells a holder, and what the bank promises of all three.

What it demonstrates:

- One module holding both — the vocabulary and the requirements standing on
  it. Names of its own are written short: `[transfer|transfer]`, not the
  qualified form a foreign module would need.
- **Every form of reference.** A part — `[transfer.payer|account it is paid
  from]`; a value of an enum — `[transfer-state.settled|settled]`; a name
  given to one thing of a type and used afterwards — `[account#one|account]`
  and then `[one.account-number|numbers]`, `[other|the second]`. R-003 needs
  the last of these: it speaks of two accounts at once, and nothing but a
  name tells them apart.
- **One member deep, and what follows.** R-001 says a payer holds enough,
  and says "a balance" in prose: `transfer.payer.balance` is no address, and
  a rule turning on the part of a part reaches it in words.
- `requirement`, `assume` and `exclude` side by side: what is promised, what
  is taken from the environment, and what has been declined outright.
- Prose stays prose. "Within the period it covers", "no reader of the books
  sees it in both at once" stand in the text of a requirement; what is
  formal is the vocabulary the text refers to. Labels are prose as well —
  where one is written in a sentence the tool passes it by.
- Where requirements live, an entity mentioned by none of them is reported.
  That is the discipline the tool keeps over a specification, and it is why
  the vocabulary here holds nothing the requirements do not use.

## Vocabularies of a technology

Entities of a particular platform declared as specialisations of the
standard ones. Unlike the specification above they hold no requirements: a
vocabulary is a vocabulary.

- [`kubernetes`](modules/kubernetes.canon) — the units in which
  workloads are placed, addressed, configured, given storage and granted
  authority.

What it demonstrates:

- An entity is declared a variety of a standard one through
  `entity <name> : <module>:<entity>` and inherits its composition.
- A definition describes the meaning of the entity in the terms of the
  technology, not the way it is implemented.
- A short name may repeat one the library already holds: `cluster`,
  `container` and `service` stand here beside `infrastructure:cluster` and
  `system:service`, and nothing collides — a foreign name is always written
  qualified, and that is what the qualification is for.

Kubernetes will be replaced, `runtime:process` and `network:endpoint` will
remain — which is why entities like these are not added to the standard
library.

## Checking

Their paths are named outright, together with the library they build on. A
test does the same, so an example that stops parsing breaks the build:

    cd ..
    npm run check -- stdlib examples
