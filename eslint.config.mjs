import eslint from '@eslint/js';
import {defineConfig, globalIgnores} from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'node_modules/',
    'main.js',
    'spikes/',
    'The Rules/',
    'releases/',
    'vitest.config.ts.timestamp-*',
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    // Architecture rule (CLAUDE.md): the core knows nothing about Obsidian,
    // Node, or I/O.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['obsidian', 'electron', 'node:*', 'fs', 'path'],
              message:
                'src/core must stay pure: no Obsidian, Electron, or Node imports.',
            },
          ],
        },
      ],
    },
  },
);
