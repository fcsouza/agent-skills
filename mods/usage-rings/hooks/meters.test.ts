import { describe, expect, test } from 'claude-code/testing';

import { colorOf, countdown, metersOf, ringOf } from './meters';

describe('meters', () => {
  test('colorOf steps green, yellow, orange, red', () => {
    expect(colorOf(31)).toBe('#22c55e');
    expect(colorOf(60)).toBe('#eab308');
    expect(colorOf(80)).toBe('#f97316');
    expect(colorOf(95)).toBe('#ef4444');
  });

  test('ringOf fills by quarter', () => {
    expect(ringOf(0)).toBe('○');
    expect(ringOf(31)).toBe('◔');
    expect(ringOf(50)).toBe('◑');
    expect(ringOf(100)).toBe('●');
  });

  test('metersOf names the windows and counts down to reset', () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const meters = metersOf(
      {
        context: { percent: 31.4 },
        rateLimits: [
          { kind: 'five_hour', percentUsed: 12, resetsAt: '2026-10-18T14:05:00Z' },
          { kind: 'seven_day', percentUsed: 24 },
        ],
      },
      now,
    );
    expect(meters).toEqual([
      { label: 'context', percent: 31 },
      { label: '5h', percent: 12, resets: '2h05' },
      { label: '7d', percent: 24 },
    ]);
  });

  test('countdown handles days and the past', () => {
    expect(countdown(26 * 3_600_000)).toBe('1d2h');
    expect(countdown(-1)).toBeUndefined();
  });
});
