export function buildPlugin(options: {
  outfile: string;
  logLevel?: 'silent' | 'info' | 'warning' | 'error';
}): Promise<void>;
