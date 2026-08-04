# The specification language

This directory defines the canon language: a modular vocabulary of
entities, the composition of records, and requirements in prose with
references to the entities.

## The idea

What is described formally is what an implementer builds the data schema
from: which entities exist, what is made of what, how many parts there are,
which values are admissible. Everything else — requirements, constraints,
deadlines, behaviour — is written in prose.

Precision rests not on parsing the text of a requirement but on
**vocabulary discipline**: you may speak only of what has been declared
somewhere, and a reference to an undeclared entity does not pass the check.
A requirement also carries a stable label, so that a reviewer, an agent and
the code name one and the same thing.

Earlier versions tried to make the text of a requirement formal as well, on
a restricted subset of English modelled on Attempto Controlled English. The
approach was dropped: the text looked like ordinary English but was
understood by a declared rule, and the divergence stayed invisible to the
reviewer. Prose declared to be prose creates no such divergence.

## Contents

- [`language.md`](language.md) — every construct of the language and what
  stays prose;
- [`grammar.ebnf`](grammar.ebnf) — the collected grammar, LL(1).

The documents are normative together: the EBNF sets the admissible order of
tokens, the prose the meaning of the constructs. A divergence between the
prose, the grammar and the parser is a defect.

## Checking

    cd ..
    npm run check -- stdlib

The paths making up the set can be named in `.canon/canon.toml` instead, once,
and the tool reads it when none are given. They are relative to `.canon`. They
may also be named on the command line:

    npm run check -- stdlib ../../../specs
