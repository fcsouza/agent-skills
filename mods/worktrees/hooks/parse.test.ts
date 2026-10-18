import { describe, expect, test } from 'claude-code/testing';

import { countChanges, parseWorktrees } from './parse';

describe('parse', () => {
  test('parseWorktrees reads branches and detached heads, skips bare', () => {
    const porcelain = [
      'worktree /repo',
      'HEAD 1111111aaaaaaa',
      'branch refs/heads/main',
      '',
      'worktree /repo/.claude/worktrees/x',
      'HEAD 2222222bbbbbbb',
      'branch refs/heads/feat/x',
      '',
      'worktree /tmp/detached',
      'HEAD 3333333ccccccc',
      'detached',
      '',
      'worktree /bare',
      'bare',
    ].join('\n');
    expect(parseWorktrees(porcelain)).toEqual([
      { path: '/repo', branch: 'main' },
      { path: '/repo/.claude/worktrees/x', branch: 'feat/x' },
      { path: '/tmp/detached', branch: '(3333333)' },
    ]);
  });

  test('countChanges counts non-empty lines', () => {
    expect(countChanges(' M a.ts\n?? b.ts\n')).toBe(2);
    expect(countChanges('')).toBe(0);
  });
});
