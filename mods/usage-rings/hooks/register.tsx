import type { EngineInterface, Register, Timer } from 'claude-code';

import { colorOf, type Meter, metersOf, ringOf } from './meters';

const REFRESH_MS = 30_000;

let meters: Meter[] = [];
let timer: Timer | undefined;
// The action a button started and that has not finished yet; its buttons hide meanwhile.
let running: 'compact' | 'review' | null = null;

// Runs a slash command as if typed. With `submitOnFailure`, a command the engine will not
// run directly (a skill) is submitted as the user's prompt instead; /compact never is, so a
// compaction that fails is not started twice.
// Work a press starts is cancelled when the press ends, so a timer starts the command in
// a dispatch of its own that lasts until the command ends.
function runCommand($: EngineInterface, action: 'compact' | 'review', command: string, args = '', submitOnFailure = false): void {
  running = action;
  $.ui.invalidate('ui.render');
  $.clock.after(1, () =>
    $.command
      .run({ command, args })
      .catch((error: unknown) => {
        if (!submitOnFailure) throw error;
        return $.prompt.submit({ text: `/${command}${args === '' ? '' : ` ${args}`}`, asUser: true });
      })
      .catch((error: unknown) => $.ui.toast(`/${command} failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        running = null;
        $.ui.invalidate('ui.render');
      }),
  );
}

async function refresh($: EngineInterface): Promise<void> {
  const [usage, now] = await Promise.all([$.session.usage(), $.clock.now()]);
  meters = metersOf(usage, now);
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
    const { Box, Button, Text } = $.ui.resolve(e);
    const canAct = !e.props.isWorking && running === null;
    return (
      <Box flexDirection="column">
        <Box gap={3} justifyContent="center">
          {meters.map(meter => (
            <Box gap={1}>
              <Text color={colorOf(meter.percent)}>{ringOf(meter.percent)}</Text>
              <Text bold color={colorOf(meter.percent)}>
                {meter.percent}%
              </Text>
              <Text dimColor>
                {meter.label}
                {meter.resets === undefined ? '' : ` · ${meter.resets}`}
              </Text>
            </Box>
          ))}
          {canAct ? (
            <Box gap={1}>
              <Button key="compact" label="Compact" onPress={() => runCommand($, 'compact', 'compact')} />
              <Button key="review" label="Code review" onPress={() => runCommand($, 'review', 'code-review', 'high --fix', true)} />
            </Box>
          ) : null}
        </Box>
        {below}
      </Box>
    );
  });
};
