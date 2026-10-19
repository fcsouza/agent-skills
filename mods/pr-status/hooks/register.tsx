import type { EngineInterface, Register, Timer } from 'claude-code';

import { GH_FIELDS, parsePr, type PrStatus } from './status';

const REFRESH_MS = 60_000;

let pr: PrStatus | null = null;
let timer: Timer | undefined;

async function refresh($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd();
  const run = await $.process.run(['gh', 'pr', 'view', '--json', GH_FIELDS], { cwd, timeoutMs: 10_000 }).catch(() => null);
  // No gh, no repo, no PR for this branch: the band stays hidden.
  pr = run === null || run.exitCode !== 0 ? null : parsePr(run.stdout);
  $.ui.invalidate('ui.render');
}

const REVIEW_TEXT = { approved: '✓ approved', changes: '✗ changes requested', pending: '● review pending', none: '' } as const;
const REVIEW_COLOR = { approved: '#22c55e', changes: '#ef4444', pending: '#eab308', none: undefined } as const;

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
    // Subagent turns end too; only the main turn's end is worth a gh call.
    // Started on a timer so the turn is not held up while gh answers.
    if (e.agentId === undefined) $.clock.after(1, () => refresh($).catch(() => undefined));
    return done;
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e);
    if (e.props.hasSurvey || pr === null || pr.state !== 'OPEN') return below;

    const { Box, Text } = $.ui.resolve(e);
    const narrow = (e.viewport?.columns ?? Number.POSITIVE_INFINITY) < 80;
    const ciColor = pr.fail > 0 ? '#ef4444' : pr.running > 0 ? '#eab308' : '#22c55e';
    return (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          <Text bold color={ciColor}>
            PR #{pr.number}
          </Text>
          {pr.isDraft ? <Text dimColor>draft</Text> : null}
          {narrow ? null : (
            <Text dimColor wrap="truncate-end">
              {pr.title}
            </Text>
          )}
          {pr.pass > 0 ? <Text color="#22c55e">✓{pr.pass}</Text> : null}
          {pr.fail > 0 ? <Text color="#ef4444">✗{pr.fail}</Text> : null}
          {pr.running > 0 ? <Text color="#eab308">●{pr.running}</Text> : null}
          {pr.pass + pr.fail + pr.running === 0 ? <Text dimColor>no checks</Text> : null}
          {pr.review === 'none' ? null : <Text color={REVIEW_COLOR[pr.review]}>{narrow ? REVIEW_TEXT[pr.review].split(' ')[0] : REVIEW_TEXT[pr.review]}</Text>}
        </Box>
        {below}
      </Box>
    );
  });
};
