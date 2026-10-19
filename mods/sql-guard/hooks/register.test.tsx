import type { On } from 'claude-code';
import { describe, expect, mock, test, tier } from 'claude-code/testing';

tier('user');

const ran = (on: On, log: string[]) =>
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    log.push(String((e as { command?: unknown }).command));
    return { result: { stdout: '', stderr: '', interrupted: false } } as never;
  });

describe('register', () => {
  test('a write to a local database runs without asking', async ($, on) => {
    const log: string[] = [];
    ran(on, log);
    const call = await $.tool.call({ tool: 'Bash', command: 'psql -h localhost -c "DELETE FROM t"' });
    expect(call.deny).toBeUndefined();
    expect(log).toHaveLength(1);
  });

  test('a write to a remote database waits, and Cancel denies it', async ($, on) => {
    const clock = mock.clock(on);
    const log: string[] = [];
    ran(on, log);
    on('ui.open', () => ({ value: { isPlaced: true } }));
    on('ui.close', () => ({ value: undefined }));

    const pending = $.tool.call({ tool: 'Bash', command: 'psql postgres://u:pw@db.prod.io/app -c "DROP TABLE users"' });
    await clock.settle();
    expect(log).toHaveLength(0);
    await $.ui.render({ component: 'Pane', requestId: 'sql-guard', surface: 'terminal', props: {} as never });
    await $.ui.press({ plugin: 'sql-guard', key: 'cancel' });
    clock.advance(500);

    const call = await pending;
    expect(call.deny).toContain('db.prod.io');
    expect(log).toHaveLength(0);
  });
});
