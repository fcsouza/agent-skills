import { describe, expect, test, tier } from 'claude-code/testing';

import { LEAK_PARTS } from './rules';

tier('user');

const leakyDiff = ['+++ b/bun.lock', `+  "dep": "link:${LEAK_PARTS[0]}someone/lib",`].join('\n');

describe('register', () => {
  test('git add -A is denied and never runs', async ($, on) => {
    let ran = false;
    on('session.cwd', () => ({ value: '/work' }));
    on('tool.call', { tool: 'Bash' }, () => {
      ran = true;
      return { result: { stdout: '', stderr: '', interrupted: false } };
    });

    const call = await $.tool.call({ tool: 'Bash', command: 'git add -A && git commit -m x' });

    expect(call.deny).toContain('stages every file');
    expect(ran).toBe(false);
  });

  test('a commit whose staged diff holds a home path is denied', async ($, on) => {
    on('session.cwd', () => ({ value: '/work' }));
    on('process.run', ($, e) => ({
      value: { exitCode: 0, stdout: e.argv.includes('diff') ? leakyDiff : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }));

    const call = await $.tool.call({ tool: 'Bash', command: 'git commit -m "bump"' });

    expect(call.deny).toContain('bun.lock');
  });

  test('a push from main with no refspec is denied; a feature branch passes', async ($, on) => {
    let branch = 'main';
    on('session.cwd', () => ({ value: '/work' }));
    on('process.run', () => ({ value: { exitCode: 0, stdout: `${branch}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }));
    on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'pushed', stderr: '', interrupted: false } }));

    const fromMain = await $.tool.call({ tool: 'Bash', command: 'git push' });
    expect(fromMain.deny).toContain('main');

    branch = 'feat/x';
    const fromBranch = await $.tool.call({ tool: 'Bash', command: 'git push -u origin feat/x' });
    expect(fromBranch.deny).toBeUndefined();
  });

  test('git add .env and a commit with a staged .env are both denied', async ($, on) => {
    on('session.cwd', () => ({ value: '/work' }));
    on('process.run', ($, e) => ({
      value: {
        exitCode: 0,
        stdout: e.argv.includes('--name-only') ? 'src/a.ts\n.env.local\n' : '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }));

    const add = await $.tool.call({ tool: 'Bash', command: 'git add src/a.ts .env' });
    expect(add.deny).toContain('.env');

    const commit = await $.tool.call({ tool: 'Bash', command: 'git commit -m "x"' });
    expect(commit.deny).toContain('.env.local');
  });
});
