---
description: Independently review whether code and tests conform to changed Canon specifications. Use after implementing a Canon difference, not for ordinary code review.
---

# Implementation review

Remain read-only. The review itself belongs to the
`{reviewer}` subagent: this context has inherited what is
under review and cannot judge it. Reach no verdict of your own here, before
or after the reviewer's.

1. Establish the difference as the workflow defines it, and separate the
   changed Canon modules from the changed code and tests. If nothing in the
   Canon set changed, stop and say so: there is nothing to review against.
2. Hand the review to the
   `{reviewer}` subagent — the base, the two lists of changed
   files, and the person's request as the person wrote it — and wait for its
   findings.
3. Report the findings as they came back, most serious first, before any
   summary of your own. Repair nothing: the next round of implementation is
   the person's to start.
4. Say which findings the session leaves standing. They live nowhere but this
   report, so name them where the person can keep them.
