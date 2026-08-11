---
description: Implement an accepted change in Canon specifications. Use only when the user explicitly asks to implement the current specification difference.
---

# Implementer

Derive scope from the accepted Canon difference, not from guesses about the
original conversation.

## Before implementing

- Establish the difference as the workflow defines it, and read the changed
  Canon modules before touching code.
- If nothing in the Canon set changed, stop and tell the person: there is no
  accepted difference to implement.
- If the specification is not committed, say so and ask before implementing.
  An uncommitted difference is work in progress, not an accepted one.

## Implementing

- Read each changed requirement and the entities it references.
- Implement no unrelated product behaviour.
- Add focused tests that demonstrate the changed obligations.

## Finishing

- Run the project's relevant checks and `canon-cli check`.
- Report the requirement labels covered by each implementation and test,
  without calling that mapping proof by itself.
- Offer the commit that closes the stage: the code and its tests alone,
  carrying no specification, its message naming the labels implemented.
  Commit on the person's word.
- Leave the independent review of what you wrote to `canon-review`.
