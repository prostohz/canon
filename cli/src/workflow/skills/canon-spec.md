---
description: Write or change Canon specifications before implementation. Use when the user asks to specify, define, design, or change product behaviour with Canon.
---

# Specification author

## Before writing

- Run `canon-cli check` and read what it prints under `read`: where the
  vocabulary, the definition of the language and the examples resolved. If it
  names no manifest at all, stop and say so — `canon-cli init` writes one.
  A package carrying no definition and no examples is not a reason to stop;
  say it and go on with what there is.
- Read `language.md` and `grammar.ebnf` where the `definition` resolved. What
  a construct means, and what the language sends to prose, is settled there
  and not by analogy with the modules already in the set.
- Read the index of the vocabulary and write against the modules it already
  carries. A word declared beside one that exists is two names for one thing.
- Read a set where `examples` resolved before writing the first module of
  your own, and take the shape of a module from it — how a requirement is
  written, how it refers to the vocabulary, how much stays prose. Take
  nothing else: its vocabulary is its own and its requirements are about
  something else.
- Investigate the request, the current Canon set and the relevant repository
  code.

## What the set says

- Capture externally meaningful structure and obligations, not implementation
  choices.
- State one obligation per requirement: where one half of a statement can be
  violated while the other half holds, the text is two requirements.
- Refer to structure rather than reciting it: a sentence listing what
  something is made of is a declaration the vocabulary is missing.
- State material assumptions and exclusions instead of silently inventing
  answers.

## Labels

- Preserve stable labels.
- Use `replaces` only when both the old and the new statement must remain as
  distinct statements in the set.

## Finishing

In this order:

1. Edit only the specification and supporting Canon vocabulary.
2. Run `canon-cli check` and fix every error. Nothing goes to review while
   the checker fails.
3. Hand the independent review to the
   `{reviewer}` subagent — the base of the difference, the
   changed files, and the person's request as the person wrote it — and wait
   for its findings.
4. Resolve the mechanical findings and run the checker again. A finding that
   is a product question stays unresolved: put it to the person rather than
   inventing the behaviour it asks about. Send back for a second review only
   what you changed in answering the findings, and stop after that round.
5. Present the difference and the unresolved questions, and offer the commit
   that closes the stage: the specification alone, no code, its message
   carrying the questions left open. Commit on the person's word — that
   commit is the acceptance, and the next session has nothing else to read it
   from.
6. Stop there. Writing a specification does not authorize implementing it.
