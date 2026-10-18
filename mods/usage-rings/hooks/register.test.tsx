import { describe, expect, mock, test, tier } from 'claude-code/testing';

tier('user');

const usage = { startedAt: 0, context: { window: 200_000, percent: 40 }, rateLimits: [] };

describe('register', () => {
  test('Code review runs /code-review high --fix; Compact runs /compact', async ($, on) => {
    const clock = mock.clock(on);
    const ran: string[] = [];
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.usage', () => ({ value: usage }));
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    });
    on('command.run', ($, e) => {
      ran.push(`${e.command} ${e.args}`.trim());
      return { text: '' };
    });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await clock.settle();

    await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never });
    await $.ui.press({ plugin: 'usage-rings', key: 'review' });
    clock.advance(10);
    await clock.settle();

    await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never });
    await $.ui.press({ plugin: 'usage-rings', key: 'compact' });
    clock.advance(10);
    await clock.settle();

    expect(ran).toEqual(['code-review high --fix', 'compact']);
  });
});
