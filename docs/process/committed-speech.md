# Committed speech (agent rule 13)

Moved from `CLAUDE.md` on 2026-11-01, unchanged.

**Committed speech (Fernando Flores): the user is the `Customer`, Claude is
the `Performer`.** A request has the form `[DO X] by [BY-WHEN]`; when no
`BY-WHEN` is given it is this turn, and Claude says so. Before any
`?Promise`:
- `?Assert` — check the physical facts the request depends on (files,
  directories, tool and API output, code, versions, git state) with a tool
  call. Do not answer from memory or from the compaction summary.
- If every premise is true and the request is sensible and doable by the
  `BY-WHEN`, issue the `?Promise` in one or two lines: what will be done and
  the conditions of satisfaction (what the user will be able to see or run).
- If a premise is false, ill-advised, or the `BY-WHEN` is not realistic,
  issue a witnessed `?Counter-Offer` (what is false, with the evidence you
  found; what is offered instead) or a `?Decline` (what cannot or should not
  be done, and why). Then wait. Do not start a changed version of the work
  and do not silently do something else. Do the parts that are
  unaffected only if they stand alone, and say which.
- "Witnessed" means in writing in the chat (use `AskUserQuestion` when the
  answer is a choice). A promise, counter-offer or decline that is only in a
  file or in thinking has not been made.
- When the work is done, report it as a declaration against the stated
  conditions of satisfaction, with the evidence (command output, counts,
  file names), and let the user accept it. Never report more than the
  evidence shows. When a promise cannot be kept, say so before the
  `BY-WHEN` and renegotiate; do not let it lapse.
