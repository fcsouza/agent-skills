import { describe, expect, test } from 'claude-code/testing';

import { addedText, addsUnguardedTransport } from './rules';

describe('rules', () => {
  test('catches pino.transport and transport targets', () => {
    expect(addsUnguardedTransport('const t = pino.transport({ target: "pino-pretty" })')).toBe(true);
    expect(addsUnguardedTransport('pino({ level: "info", transport: { target: "pino-pretty" } })')).toBe(true);
    expect(addsUnguardedTransport('pino({ transport: { targets: [a, b] } })')).toBe(true);
  });

  test('allows multistream and dev-guarded transports', () => {
    expect(addsUnguardedTransport('pino({}, pino.multistream([{ stream: process.stdout }]))')).toBe(false);
    expect(addsUnguardedTransport('const logger = isDevelopment() ? pino({ transport: { target: "pino-pretty" } }) : pino()')).toBe(false);
    expect(addsUnguardedTransport('const transport = { level: "x" }')).toBe(false);
  });

  test('addedText reads Write, Edit and MultiEdit', () => {
    expect(addedText({ content: 'a' })).toBe('a');
    expect(addedText({ new_string: 'b' })).toBe('b');
    expect(addedText({ edits: [{ new_string: 'c' }, { old_string: 'x' }, { new_string: 'd' }] })).toBe('c\n\nd');
  });
});
