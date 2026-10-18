import type { EngineInterface, Register, Timer } from 'claude-code';

import { countChanges, parseWorktrees, type Worktree } from './parse';

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
    await refresh($).catch(() => undefined);
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
    return (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          <Text color={full ? '#ef4444' : '#a78bfa'} bold>
            ⑂ {trees.length}/{LIMIT}
          </Text>
          {trees.map(tree => (
            <Text>
              <Text color={tree.path === current ? '#38bdf8' : undefined} bold={tree.path === current}>
                {tree.branch}
              </Text>
              <Text color={tree.changes > 0 ? '#f59e0b' : '#22c55e'}>{tree.changes > 0 ? ` ●${tree.changes}` : ' ✓'}</Text>
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    );
  });
};
