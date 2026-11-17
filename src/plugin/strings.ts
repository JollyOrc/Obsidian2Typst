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
} as const;
