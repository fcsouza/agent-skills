import { describe, expect, test } from 'claude-code/testing';

import { type AgentRun, applyProgress, elapsed, LINGER_MS, modelLabel, progressBar, sweepBar, visible } from './agents';

const run = (over: Partial<AgentRun>): AgentRun => ({ agentId: 'a', description: 'd', model: 'm', status: 'running', startedAt: 0, tools: 0, ...over });

describe('agents', () => {
  test('modelLabel names the family and version', () => {
    expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
    expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5');
    expect(modelLabel('claude-fable-5-1[1m]')).toBe('Fable 5.1');
    expect(modelLabel('gpt-x')).toBe('gpt-x');
  });

  test('elapsed reads seconds, minutes and hours', () => {
    expect(elapsed(9_400)).toBe('9s');
    expect(elapsed(65_000)).toBe('1m05s');
    expect(elapsed(3_720_000)).toBe('1h02m');
  });

  test('visible keeps running rows and recent finished ones', () => {
    const runs = [run({ agentId: 'r' }), run({ agentId: 'new', status: 'done', endedAt: 100 }), run({ agentId: 'old', status: 'failed', endedAt: 0 })];
    expect(visible(runs, LINGER_MS + 50).map(r => r.agentId)).toEqual(['r', 'new']);
  });
});

describe('progress', () => {
  test('applyProgress clamps done to the plan and keeps old values for bad input', () => {
    const base = run({});
    const planned = applyProgress(base, { done: 0, total: 5, note: 'reading files' });
    expect(planned).toMatchObject({ stepDone: 0, stepTotal: 5, stepNote: 'reading files' });
    expect(applyProgress(planned, { done: 9 })).toMatchObject({ stepDone: 5, stepTotal: 5, stepNote: 'reading files' });
    expect(applyProgress(planned, { done: -1, total: 'x' })).toMatchObject({ stepDone: 0, stepTotal: 5 });
  });

  test('progressBar fills by share; sweepBar moves a 3-cell block', () => {
    expect(progressBar(3, 6)).toBe('▰▰▰▰▱▱▱▱');
    expect(progressBar(1, 1)).toBe('▰▰▰▰▰▰▰▰');
    expect(sweepBar(0)).toBe('▰▱▱▱▱▱▱▱');
    expect(sweepBar(4_000)).toBe('▱▱▰▰▰▱▱▱');
  });
});
