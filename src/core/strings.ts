// US-042 AC-14: the core's texts that become notices. The plugin's string table
// carries this table as `STRINGS.core`, so the texts are in one table while the
// core imports nothing of the plugin. Preset validation messages and conversion
// warnings stay with the code that finds them (owner, 2026-11-18).

export const CORE_STRINGS = {
  report: {
    exported: (pdf: string, folder: string): string =>
      `✅ Exported ${pdf} to ${folder}`,
    warnings: (count: number): string =>
      `${count} warning${count === 1 ? '' : 's'}`,
    withWarnings: (head: string, warnings: string): string =>
      `${head}, ${warnings} (see export-warnings.md)`,
    failed: (message: string): string => `❌ Export failed: ${message}`,
    cancelled: '❌ Export cancelled.',
    aborted: (warnings: string): string =>
      `❌ Export aborted: ${warnings} (strict mode)`,
    line: (line: number, code: string): string => `line ${line}: ${code}`,
  },
  compile: {
    first: 'Compiling…',
    again: (n: number, limit: number): string =>
      `Compiling… (${n} of up to ${limit})`,
    errorAt: (
      path: string,
      row: string,
      column: string,
      text: string,
    ): string => `Typst error at ${path}:${row}:${column}: ${text}`,
    error: (line: string): string => `Typst error: ${line}`,
    unknownError: 'unknown error',
  },
  presets: {
    numbering: 'Invalid heading numbering; "1.1" is used',
  },
} as const;
