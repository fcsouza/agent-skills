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

  test('a spawned subagent gets a row with its model, and its tool calls are counted', async ($, on) => {
    const clock = mock.clock(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.usage', () => ({ value: usage }));
    on('agent.spawn', () => ({ model: 'claude-haiku-4-5-20251001', agentId: 'sub-1' }));
    on('tool.call', () => ({ result: 'ok' }));
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Test subagent', subagentType: 'Explore', parentModel: 'claude-opus-5-5' } as never);
    await $.tool.call({ tool: 'Read', file_path: '/work/a', agentId: 'sub-1' } as never);
    await clock.settle();
    const tree = await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never });
    const drawn = JSON.stringify(tree);
    expect(drawn).toContain('Test subagent');
    expect(drawn).toContain('Haiku 4.5');
    expect(drawn).toContain('1 tool');
  });

  test('a subagent that reports its plan gets a real bar; the brief is added to its prompt', async ($, on) => {
    const clock = mock.clock(on);
    let prompt = '';
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.usage', () => ({ value: usage }));
    on('tool.register', () => ({ value: {} }) as never);
    on('agent.spawn', ($, e) => {
      prompt = e.prompt;
      return { model: 'claude-opus-5-5', agentId: 'sub-2' };
    });
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await $.agent.spawn({
      tool_use_id: 't2',
      prompt: 'do it',
      description: 'Planner',
      subagentType: 'general-purpose',
      parentModel: 'claude-opus-5-5',
    } as never);
    const call = await $.tool.call({ tool: 'mcp__usage-rings__progress', done: 2, total: 5, note: 'reading files', agentId: 'sub-2' } as never);
    await clock.settle();
    const drawn = JSON.stringify(await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never }));
    expect(prompt).toContain('progress');
    expect(call.deny).toBeUndefined();
    expect(drawn).toContain('2/5');
    expect(drawn).toContain('reading files');
    expect(drawn).toContain('0 tools');
  });
});
