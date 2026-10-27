// TICKET-003: the lint configuration enforces the project rules.
import {ESLint} from 'eslint';
import {describe, expect, it} from 'vitest';

async function lint(code: string, filePath: string) {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, {filePath});
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe('TICKET-003 lint rules', () => {
  it('TICKET-003: reports an unused variable', async () => {
    const rules = await lint(
      'const unused = 1;\nexport {};\n',
      'src/core/x.ts',
    );
    expect(rules).toContain('@typescript-eslint/no-unused-vars');
  });

  it('TICKET-003: forbids importing obsidian in src/core', async () => {
    const code = "import {Notice} from 'obsidian';\nexport const n = Notice;\n";
    expect(await lint(code, 'src/core/x.ts')).toContain(
      'no-restricted-imports',
    );
    expect(await lint(code, 'src/plugin/x.ts')).not.toContain(
      'no-restricted-imports',
    );
  });

  it('TICKET-003: forbids node: imports in src/core', async () => {
    const code =
      "import {readFileSync} from 'node:fs';\nexport const r = readFileSync;\n";
    expect(await lint(code, 'src/core/x.ts')).toContain(
      'no-restricted-imports',
    );
  });
});
