// US-042 AC-14: the one string table of the plugin's screens, menus and notices.
// Every text a control or a notice shows comes from here (a tooling test checks
// `src/plugin`); texts built from values are functions. Started at T2 (#176)
// with the export dialog's texts; T6 (#180) moves the rest in.

export const STRINGS = {
  empty: '',
  dialog: {
    folderPlaceholder: '/path/to/export folder',
    chooseFolder: 'Choose folder…',
    export: 'Export',
    moreOptions: 'More options',
  },
  progress: {
    tabTitle: 'Export',
    cancel: 'Cancel',
    close: 'Close',
    line: (n: number): string => `line ${n}`,
  },
  notices: {
    openNote: 'Open a note to export it.',
    debugInfoCopied: 'Debug info copied.',
  },
  tab: {
    version: (v: string): string => `Obsidian2Typst ${v}`,
    copyDebugInfo: 'Copy debug info',
    resetSection: 'Reset this section to defaults',
  },
  sectionReset: {
    title: (name: string): string => `Reset "${name}" to its defaults?`,
    line: 'Your values in this section will be removed; presets that do not set them use the built-in values.',
    confirm: 'Reset',
    cancel: 'Cancel',
  },
} as const;
