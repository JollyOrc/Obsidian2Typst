# Step 0 — SCAR review checklist

Moved from `CLAUDE.md` (development process, step 0) on 2026-11-01, unchanged;
SCAR-031 and SCAR-032 added 2026-11-03 (the user's go).
Read `scars/README.md` and every SCAR file under `scars/`, then check the new
instructions or user story against each question below.

- Are all ACs stated with concrete input/output examples? (SCAR-007)
- Do the ACs cover nested/composed usage, not just the top-level case, and
  has every example been run through the whole converter with every other
  story's rules and the built-in defaults on, and do the composed cases name
  inline wrappers (bold, links) as well as block containers, and is every
  example of plugin behaviour checked against the plugin rules it passes
  through (preview controller, panel, settings)? (SCAR-002)
- Is there a test stub for every AC before any code is written? (SCAR-003)
- Does any shared utility get a new call site? If so, are all its transforms
  documented and verified as appropriate for this use? (SCAR-001)
- Is the test suite required to be fully green before this work ships? (SCAR-006)
- Does the work call a third-party API (canvas, renderer, compiler) whose
  options were read from its type definitions, with a programmatic check of
  the output, and is every canvas created by the one helper? (SCAR-008)
- Was every alternative measured with the real consumer before it was
  offered as a choice, or is an unmeasured one marked so? (SCAR-020)
- Is output that depends on its own layout (`context`, `locate`, "unless on
  this page") swept across a page edge and checked for being stable?
  (SCAR-021)
- For every callback (event, menu, command, render hook), was it read from
  the types whether it runs synchronously, and is each datum it needs
  listed as in memory or an async read (the latter moved into the action
  after the click), when the story is written? (SCAR-022)
- Is every statement in the story about what a dependency does split into
  its parts, each with a test with the real tool, or marked as not
  measured, and is an explanation of an observed failure marked unverified
  until a test shows it? (SCAR-024)
- Was every search result (a word list, a pattern) classified by context
  before it was counted, offered as a choice or replaced, does a choice show
  the split, and does a scripted replace work from a reviewed keep-list?
  (SCAR-026)
- When something is replaced (a fixture, a vault, a file format, a
  library), is every user of it listed with what it asserts or assumes,
  before the replacement's acceptance criteria are written? (SCAR-027)
- Does every test helper that reads output (a PDF, YAML or source reader)
  have tests for the syntax rules of its format, and when it returns less
  than the source holds, is the reader checked on a known input before the
  input is blamed? (SCAR-028)
- Is every unit a human runs, answers or approves on its own (a manual
  check, a checklist, a questionnaire, a handover note) a file of its own
  named by its id, linked from one index that a test keeps one to one with
  the files, and read by tests through one reader by its id? (SCAR-029)
- Does every test that does seconds of work itself (converting a whole
  note, compressing, compiling, building) state its time limit, measured
  under a full parallel run with a margin, is a timeout run alone before
  the code is blamed, and does a raised limit reach every test doing the
  same work? (SCAR-030)
- Does the plugin's entry point (`main.ts`, a view's constructor) only build
  Obsidian objects and hand them over, with every decision in a function
  with tests, does the mutation run include new wiring there, and is each
  remaining hand-over line guarded by a text check? (SCAR-031)
- Does every finding a story, decision or option relies on state its scope
  (call, inputs, range), does a negative finding name the paths not tried,
  and was an option measured across the inputs it is offered for? (SCAR-032)
- Are rules for generated text checked in every position (start, middle,
  end, around line breaks) against the real consumer? (SCAR-009)
- Where output is built by concatenating pieces, are the join hazards of
  each piece type listed, measured with the real consumer, and tested as
  piece × neighbour with guard tests and a mutation check? (SCAR-010)
- Where a rule makes generated names unique (labels, file names, keys), is
  the invariant stated, and is a natural name that looks like a generated
  one tested? (SCAR-011)
- Before a manual test is handed to a human: is the environment complete and
  current (build installed and compared with the fresh build, fixtures in
  place), does the build have a new unique version shown in the app, and
  does the check text start with that version and the place where it runs?
  Does every file a fixture names by its name have a name that is unique
  where it is looked up, shown by a listing? (SCAR-012) Is a rendered result
  that is judged by eye inspected at reading size, with the joins of
  separately drawn parts zoomed in on? (SCAR-025)
- Does every dialog with an input field specify Enter = confirm, Escape =
  cancel and the IME-composition case (SCAR-013)? Does every action that
  deletes, overwrites or irreversibly changes user data have a
  confirmation with the safe choice as default, and is the worst misplaced
  click on each screen listed (SCAR-014)?
- Does every end-to-end criterion and manual check state the content the
  output must have (text, fonts, images), is there a guard test for the
  blank result, and does the check ask for anything odd that the list did
  not mention (SCAR-015)?
- Does every control (button, icon, switch, field) read the state when it is
  used and not a value captured while the screen was drawn, does each AC
  have an example in the order draw, change the data, use the control, is
  the manual step run without closing the tab, does a new way to change
  a value list every screen that shows it and how each updates, and does
  every loader announce its load to screens drawn before it (SCAR-016)?
- When a defect was reported: was the pattern searched in the whole code
  base, is every instance listed in the ticket (fixed or why not affected),
  is the rule stated for the class in the story, and does one function plus
  a text check over the file keep a new copy from bypassing it? Does a story
  that adds a way to change a value list every writer, found by a grep for
  the value? Do the fix's own story, tests and tickets go through the same
  check? (SCAR-017)
- Does every guard check exactly its criterion, not less and not more: does
  a guard over output count the places it checked, does a text check match
  the whole statement, are test inputs ones the real producer gives, is
  each guard proven by a mutation check, and were the tests searched before
  tickets for guards that forbid a call the tickets add (each listed,
  narrowed to its criterion with the reason)? Does a test that one side
  wins also show that the other side was in effect? Does a test that output
  is the same on every run run the code from two fresh starts? (SCAR-023)
- Does any tooling change the sources (mutation run, scripted edit, probe
  setup)? Are the backups made by full path with a checksum list, checked
  after every restore, and is the run stopped and repeated on a failed check,
  and does the backup hold the state to return to (for a manual check, the
  state as handed over), and does a scripted edit leave out files that
  change only with the user's approval (SCAR-018)? Is a surviving mutant read first as a test input that cannot
  reach the rule (SCAR-023)? When text moves into a new container (content block, call
  argument), is its start checked as a new block start (SCAR-009)?
- Does a rule read a setting? Does it have examples and tests at the
  default, at both ends of the range and at one other value, and was a
  decision asked in terms of the default also asked for the other values
  (SCAR-019)?

Flag any gap to the user before proceeding; do not paper over it with a
guess or a TODO.
