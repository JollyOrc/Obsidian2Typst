# State directory `docs/state/` and SCAR gates

Moved from `CLAUDE.md` (agent rule 9) on 2026-11-01, unchanged.

**State directory `docs/state/` (the `init.d` of this project).** It holds
the working state that must survive a context compaction. Files, in lexical
order:
- `00_governance.md` (write-once at start; amended only when the user
  changes the process): the workflow (steps 0 to 4 in `CLAUDE.md`), the approval
  airlocks (the user's "go" before each step and before each ticket) and the
  decisions the user has made, with dates.
- `10_ticket.md` (write-once at ticket selection; replaced at the next
  selection): story and ticket ids, the ACs addressed, the SCARs the ticket
  names.
- `20_plan_approved.md` (write-once after the user's "go" for the ticket):
  the approved file list and the invariants that must hold.
- `30_scar_checks.md` (**append-only**): the SCAR ledger. One entry per SCAR
  gate (below): date, gate, story or ticket, and every SCAR as `ok`, `gap`
  (where it was fixed) or `n/a` (reason), each with its evidence (file,
  test name, command output). A gate that found gaps is followed by an entry
  that shows them closed.
- `99_next_action.md` (overwritten at each target): the checklist, `Current
  Target`, `Last Completed Step`, `Next Permitted Action` and `SCAR gate
  due`.

**SCAR gates.** The review of step 0 is repeated at every handover between
steps, and a step is neither started nor declared complete without its entry
in `30_scar_checks.md`:
- **G0** story review, before a story or an amendment is written (step 0);
- **G1** story written or amended, before any test (SCAR-002, 007, 013 to
  016, 017, 019, 020, 022, 024, 026, 027, 029, 032 against the ACs);
- **G2** tests written, before any ticket (SCAR-003, 001, 008, 011, 015,
  019, 021, 023, 024, 028, 030, 031);
- **G3** tickets written, before any code: each ticket has a "SCAR check"
  section that goes through the Prevention list of every SCAR, item by item;
- **G4** before a ticket is declared done and before every manual-test
  handover (SCAR-006, 012, 015, 016, 018, 023, 025, 026, 028, 029, 030,
  031; the
  gate and the pass counts);
- **G5** closing a story: can the root cause of anything found be
  generalised into a new SCAR?
