import type { EngineInterface, Register, Timer } from 'claude-code';

import { colorOf, type Meter, metersOf, ringOf } from './meters';

const REFRESH_MS = 30_000;

let meters: Meter[] = [];
let timer: Timer | undefined;

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
    if (meters.length === 0) {
      return below;
    }

    const { Box, Text } = $.ui.resolve(e);
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
        </Box>
        {below}
      </Box>
    );
  });
};
