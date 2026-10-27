// US-008 AC-15: the folder dialog of the desktop app. Obsidian is an Electron
// app; the dialog comes from the remote module that the app provides. The
// export needs the file system, so the plugin is desktop only (US-007 AC-8).

interface OpenDialog {
  showOpenDialog(options: {
    title: string;
    defaultPath?: string;
    properties: string[];
  }): Promise<{canceled: boolean; filePaths: string[]}>;
}

type Require = (id: string) => unknown;

/** The dialog of Electron, or null when the app does not provide it. */
function findDialog(): OpenDialog | null {
  const load = (window as unknown as {require?: Require}).require;
  if (typeof load !== 'function') return null;
  for (const id of ['@electron/remote', 'electron']) {
    try {
      const module = load(id) as {
        dialog?: OpenDialog;
        remote?: {dialog?: OpenDialog};
      };
      const dialog = module.dialog ?? module.remote?.dialog;
      if (dialog !== undefined) return dialog;
    } catch {
      // try the next module
    }
  }
  return null;
}

/**
 * Asks for the export folder, starting at `initial` when given. Returns the
 * absolute path, or null when the user cancels. Throws when the app has no
 * folder dialog.
 */
export async function chooseExportFolder(
  initial: string | null,
): Promise<string | null> {
  const dialog = findDialog();
  if (dialog === null) throw new Error('The folder dialog is not available');
  const result = await dialog.showOpenDialog({
    title: 'Export folder',
    ...(initial === null ? {} : {defaultPath: initial}),
    properties: ['openDirectory', 'createDirectory'],
  });
  const chosen = result.filePaths[0];
  return result.canceled || chosen === undefined ? null : chosen;
}
