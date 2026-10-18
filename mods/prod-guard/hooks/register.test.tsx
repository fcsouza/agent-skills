import { describe, expect, mock, test, tier } from 'claude-code/testing';

import { describeInput, isWrite } from './rules';

tier('user');

describe('register', () => {
  test('reads pass, writes are classified as writes', () => {
    expect(isWrite('mcp__dokploy__application-one')).toBe(false);
    expect(isWrite('mcp__dokploy__application-readLogs')).toBe(false);
    expect(isWrite('mcp__dokploy__project-all')).toBe(false);
    expect(isWrite('mcp__dokploy__application-deploy')).toBe(true);
    expect(isWrite('mcp__dokploy__application-saveEnvironment')).toBe(true);
    expect(isWrite('mcp__dokploy__postgres-remove')).toBe(true);
    expect(isWrite('mcp__other__thing-deploy')).toBe(false);
  });

  test('secret fields are shown by name only', () => {
    const lines = describeInput({ applicationId: 'abc', env: 'A=1\nB=2', tool: 'x', agentId: 'sub-1', requestMeta: { a: 'b' } });
    expect(lines).toEqual(['applicationId: abc', 'env: (hidden, 2 lines)']);
  });

  test('a write waits until Proceed is pressed, then runs', async ($, on) => {
    const clock = mock.clock(on);
    let ran = false;
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.close', () => ({ value: undefined }));
    on('tool.call', { tool: /^mcp__dokploy__/ }, () => {
      ran = true;
      return { result: 'deployed' };
    });

    const pending = $.tool.call({ tool: 'mcp__dokploy__application-deploy', applicationId: 'abc' });
    await clock.settle();
    expect(ran).toBe(false);

    await $.ui.render({ component: 'Pane', requestId: 'prod-guard', surface: 'terminal', props: {} as never });
    await $.ui.press({ plugin: 'prod-guard', key: 'proceed' });
    clock.advance(500);

    const call = await pending;
    expect(call.deny).toBeUndefined();
    expect(ran).toBe(true);
  });

  test('Cancel denies the write', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.close', () => ({ value: undefined }));

    const pending = $.tool.call({ tool: 'mcp__dokploy__application-stop', applicationId: 'abc' });
    await clock.settle();
    await $.ui.render({ component: 'Pane', requestId: 'prod-guard', surface: 'terminal', props: {} as never });
    await $.ui.press({ plugin: 'prod-guard', key: 'cancel' });
    clock.advance(500);

    expect((await pending).deny).toContain('Cancel');
  });
});
