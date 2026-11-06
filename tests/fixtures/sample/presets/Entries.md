---
schemaVersion: 1
page:
  trimSize: A5
  margins: {top: 20, bottom: 25, inside: 23, outside: 20}
  facingPages: true
headingRules:
  Menagerie: entries
  Relics: entries
entries:
  statblock:
    stats: [{key: might, label: Might}, {key: wits, label: Wits}, {key: speed, label: Speed}]
    traits: [{key: move, label: Move}, {key: guard, label: Guard}]
    boxes: vigour
    track:
      - {label: Fine, icon: "Sample/assets/icons/fine.svg"}
      - {label: Hurt, icon: "Sample/assets/icons/hurt.svg"}
      - {label: Down, icon: "Sample/assets/icons/down.svg"}
      - {label: Fading, icon: "Sample/assets/icons/fading.svg"}
      - {label: Gone, icon: "Sample/assets/icons/gone.svg"}
    trackKey: states
    trackLabel: STATE
    trackDefault: [Fine, Hurt, Down, Gone]
    sum: {total: vigour, of: [might, wits, speed]}
  tagLabels: {beast: Beast, magical: Magical}
  quickReference: true
  encounterSheet: true
  encounterSheetFile: true
---

The preset of the entries chapter (`Menagerie.md`, US-024 amendment for
epic #121): synthetic field names, five generated icon shapes.
