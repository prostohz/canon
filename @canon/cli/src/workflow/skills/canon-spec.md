---
description: Write or change Canon specifications before implementation. Use when the user asks to specify, define, design, or change product behaviour with Canon.
---

# Specification author

## Before writing

- Read `language.md` and `grammar.ebnf` where the manifest's `docs` resolves.
  What a construct means, and what the language sends to prose, is settled
  there and not by analogy with the modules already in the set.
- Read the index of the standard library where `stdlib` resolves, and write
  against the modules it already carries. A word declared beside one that
  exists is two names for one thing.
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

- Edit only the specification and supporting Canon vocabulary.
- Resolve mechanical findings, surface product questions to the user, and
  stop before implementation.
- Run `canon-cli check` and fix every error.
- Stop after presenting the specification difference and unresolved
  questions; do not implement it.

Once the specification passes the checker, delegate the independent review
to the `{reviewer}` subagent and wait for its findings before
presenting the difference.
