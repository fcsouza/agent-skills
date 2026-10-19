import type { EngineInterface, Register, Timer } from 'claude-code';

import { countChanges, parseWorktrees, shorten, type Worktree } from './parse';

const LIMIT = 10;
const REFRESH_MS = 60_000;

let trees: Worktree[] = [];
let timer: Timer | undefined;
let current = '';

function git($: EngineInterface, cwd: string, args: readonly string[]) {
  return $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 5_000 });
}

async function refresh($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd();
  const list = await git($, cwd, ['worktree', 'list', '--porcelain']).catch(() => null);
  if (list === null || list.exitCode !== 0) {
    trees = [];
    $.ui.invalidate('ui.render');
    return;
  }
  const top = await git($, cwd, ['rev-parse', '--show-toplevel']);
  current = top.stdout.trim();
  trees = await Promise.all(
    parseWorktrees(list.stdout).map(async tree => {
      const status = await git($, tree.path, ['status', '--porcelain']).catch(() => null);
      return { ...tree, changes: status === null ? 0 : countChanges(status.stdout) };
    }),
  );
  $.ui.invalidate('ui.render');
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await refresh($).catch(() => undefined);
    timer?.cancel();
    timer = $.clock.every(REFRESH_MS, () => {
      refresh($).catch(() => undefined);
    });
    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const done = await next(e);
    // Started on a timer so the turn is not held up by one git call per worktree.
    if (e.agentId === undefined) $.clock.after(1, () => refresh($).catch(() => undefined));
    return done;
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e);
    if (e.props.hasSurvey) {
      return below;
    }
    // One worktree is just the repo: nothing to show.
    if (trees.length < 2) {
      return below;
    }

    const { Box, Text } = $.ui.resolve(e);
    const full = trees.length >= LIMIT;
    // Narrow: only the tree this session is in, and a count of the rest.
    const narrow = (e.viewport?.columns ?? Number.POSITIVE_INFINITY) < 80;
    const shown = narrow ? trees.filter(tree => tree.path === current) : trees;
    const others = trees.length - shown.length;
    const dirtyOthers = trees.filter(tree => tree.path !== current && tree.changes > 0).length;
    return (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          <Text color={full ? '#ef4444' : '#a78bfa'} bold>
            ⑂ {trees.length}/{LIMIT}
          </Text>
          {shown.map(tree => (
            <Text>
              <Text color={tree.path === current ? '#38bdf8' : undefined} bold={tree.path === current}>
                {shorten(tree.branch, narrow ? 24 : 32)}
              </Text>
              <Text color={tree.changes > 0 ? '#f59e0b' : '#22c55e'}>{tree.changes > 0 ? ` ●${tree.changes}` : ' ✓'}</Text>
            </Text>
          ))}
          {others > 0 ? <Text dimColor>{`+${others}${dirtyOthers > 0 ? ` (${dirtyOthers} with changes)` : ''}`}</Text> : null}
        </Box>
        {below}
      </Box>
    );
  });
};
