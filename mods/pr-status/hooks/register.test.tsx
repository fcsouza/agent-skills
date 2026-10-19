import { describe, expect, test, tier } from 'claude-code/testing';

tier('user');

const ghOutput = JSON.stringify({
  number: 7,
  title: 'feat: bars',
  state: 'OPEN',
  isDraft: false,
  reviewDecision: 'APPROVED',
  statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
});

describe('register', () => {
  test('the band shows the PR number, failed checks and the review', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.cwd', () => ({ value: '/work' }));
    on('process.run', () => ({ value: { exitCode: 0, stdout: ghOutput, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }));
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const drawn = JSON.stringify(await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never }));
    expect(drawn).toContain('7');
    expect(drawn).toContain('✗');
    expect(drawn).toContain('approved');
  });

  test('no PR keeps the band hidden', async ($, on) => {
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.cwd', () => ({ value: '/work' }));
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'no pull requests found', isStdoutTruncated: false, isStderrTruncated: false } }));
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e);
      return <Box />;
    });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const drawn = JSON.stringify(await $.ui.render({ component: 'AbovePrompt', requestId: 'above-prompt', surface: 'terminal', props: {} as never }));
    expect(drawn).not.toContain('PR');
  });
});
