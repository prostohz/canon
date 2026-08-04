---
description: Implement an accepted change in Canon specifications. Use only when the user explicitly asks to implement the current specification difference.
---

# Implementer

Derive scope from the accepted Canon difference against the branch base, not
from guesses about the original conversation.

## Before implementing

- Find the Git merge base and inspect the Canon difference before touching
  code.
- If there is no specification difference, stop and tell the user.

## Implementing

- Read each changed requirement and the entities it references.
- Implement no unrelated product behaviour.
- Add focused tests that demonstrate the changed obligations.

## Finishing

- Run the project's relevant checks and `canon-cli check`.
- Report the requirement labels covered by each implementation and test,
  without calling that mapping proof by itself.
- Leave the independent review of what you wrote to `canon-review`.
