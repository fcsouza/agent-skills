import { describe, expect, test, tier } from 'claude-code/testing';

tier('user');

describe('register', () => {
  test('an unguarded transport is denied; other edits pass', async ($, on) => {
    on('tool.call', { tool: /^(Edit|Write)$/ }, () => ({ result: 'written' }));

    const bad = await $.tool.call({ tool: 'Write', file_path: '/work/src/logger.ts', content: 'export const t = pino.transport({ target: "x" })' } as never);
    expect(bad.deny).toContain('multistream');

    const fine = await $.tool.call({ tool: 'Edit', file_path: '/work/src/logger.ts', old_string: 'a', new_string: 'pino.multistream([])' } as never);
    expect(fine.deny).toBeUndefined();

    const docs = await $.tool.call({ tool: 'Write', file_path: '/work/README.md', content: 'never use pino.transport() here' } as never);
    expect(docs.deny).toBeUndefined();
  });

  test('an Edit inside a file that already has the dev guard passes', async ($, on) => {
    on('tool.call', { tool: 'Edit' }, () => ({ result: 'written' }));
    on('fs.read', () => ({ value: 'if (isDevelopment()) {\n  // transport here\n}' }) as never);
    const call = await $.tool.call({
      tool: 'Edit',
      file_path: '/work/src/logger.ts',
      old_string: '// transport here',
      new_string: 'pino.transport({ target: "pino-pretty" })',
    } as never);
    expect(call.deny).toBeUndefined();
  });
});
