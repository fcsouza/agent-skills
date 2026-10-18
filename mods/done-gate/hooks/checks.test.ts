import { describe, expect, test } from 'claude-code/testing';

import { checksIn, checksOffered, isCodeFile } from './checks';

describe('checks', () => {
  test('checksIn reads the usual commands', () => {
    expect(checksIn('bun run format')).toEqual(['format']);
    expect(checksIn('bun run lint:biome && bun run typecheck')).toEqual(['lint', 'typecheck']);
    expect(checksIn('bun test src')).toEqual(['test']);
    expect(checksIn('bunx tsc --noEmit')).toEqual(['typecheck']);
    expect(checksIn('git status')).toEqual([]);
  });

  test('checksOffered reads package.json scripts', () => {
    const pkg = JSON.stringify({ scripts: { format: 'x', 'lint:biome': 'x', typecheck: 'x', dev: 'x' } });
    expect(checksOffered(pkg)).toEqual(['format', 'lint', 'typecheck']);
    expect(checksOffered('not json')).toEqual([]);
  });

  test('isCodeFile skips docs and lockfiles', () => {
    expect(isCodeFile('src/app.tsx')).toBe(true);
    expect(isCodeFile('README.md')).toBe(false);
    expect(isCodeFile('package-lock.json')).toBe(false);
  });
});
