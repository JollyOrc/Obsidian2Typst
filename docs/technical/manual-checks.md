# Manual checks

> What only a real Obsidian can show. The automated tests use fakes or the
> compiler in Node and do not replace these. Keep this index coherent with
> `tests.md` (section "Manual smoke tests") and the user stories.

Each check is a file of its own in [`manual-checks/`](manual-checks/), so it
can be handed over, run and recorded on its own (SCAR-029). A check names the
build version it expects, where it runs, what the developer prepares, its
steps and how it is recorded. A new check gets the next number, a file
`MNN.md` and a row here.

| Check | Title | Covers |
|-------|-------|--------|
| [M1](manual-checks/M01.md) | Compiler worker in Obsidian | US-007 AC-3, AC-3b, AC-9, AC-12 |
| [M2](manual-checks/M02.md) | Presets, the settings tab and the style panel in Obsidian | US-008 AC-1, AC-3, AC-4, AC-5, AC-6, AC-8, AC-13, AC-16, AC-18; US-009 AC-11 to AC-13; US-012 AC-1 to AC-9, AC-11 to AC-15 |
| [M3](manual-checks/M03.md) | Export current note end to end | US-008 AC-9, AC-11, AC-12, AC-15, US-007 AC-1, AC-6 |
| [M4](manual-checks/M04.md) | The cover in the PDF | US-011 AC-2 to AC-9, US-007 AC-7 |
| [M5](manual-checks/M05.md) | Fonts from the vault, in the settings tab and in the PDF | US-010 AC-3 to AC-6, AC-8, US-007 AC-7 |
| [M6](manual-checks/M06.md) | Callouts in the PDF and the preview | US-016 AC-1, AC-13 to AC-16 |
| [M7](manual-checks/M07.md) | Glossary terms in the PDF and the preview | US-017 AC-4, AC-10 to AC-14 |
| [M8](manual-checks/M08.md) | Folios and running headers | US-019 AC-2, AC-4, AC-5, AC-9 to AC-11 |
| [M9](manual-checks/M09.md) | Page numbers for internal links | US-018 AC-4, AC-5, AC-7 to AC-9 |
| [M10](manual-checks/M10.md) | Ribbon and note menus | US-020 AC-3, AC-5 to AC-10 |
| [M11](manual-checks/M11.md) | Preset groups and the details pop-up | US-021 AC-3 to AC-11 |
| [M12](manual-checks/M12.md) | Heading and image menus that change the active preset | US-022 AC-1, AC-3, AC-5 to AC-12 |
| [M13](manual-checks/M13.md) | A template that styles the document: A5 MU Print | US-023 AC-1, AC-3, AC-5, AC-7, AC-11 |
| [M14](manual-checks/M14.md) | The sample vault in the exports | US-024 AC-8; US-007 AC-6, US-011, US-017 AC-13, US-018 AC-9, US-019 AC-11 |
| [M15](manual-checks/M15.md) | Page breaks by heading level | US-025 AC-2, AC-5 to AC-7, AC-10 |
| [M16](manual-checks/M16.md) | Book parts and signatures | US-026 AC-3 to AC-6, AC-9, AC-10 |
| [M17](manual-checks/M17.md) | Table of contents | US-027 AC-2 to AC-8 |
| [M18](manual-checks/M18.md) | Images that stay with their text | US-028 AC-4 to AC-6, AC-9, AC-11, AC-13 |
