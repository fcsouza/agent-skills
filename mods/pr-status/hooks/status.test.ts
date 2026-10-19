import { describe, expect, test } from 'claude-code/testing';

import { parsePr } from './status';

describe('status', () => {
  test('counts check runs and status contexts, reads the review', () => {
    const json = JSON.stringify({
      number: 12,
      title: 'feat: x',
      state: 'OPEN',
      isDraft: false,
      reviewDecision: 'CHANGES_REQUESTED',
      statusCheckRollup: [
        { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED' },
        { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' },
        { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' },
        { __typename: 'StatusContext', state: 'PENDING' },
        { __typename: 'StatusContext', state: 'ERROR' },
      ],
    });
    expect(parsePr(json)).toEqual({ number: 12, title: 'feat: x', state: 'OPEN', isDraft: false, review: 'changes', pass: 2, fail: 2, running: 2 });
  });

  test('no PR or bad output gives null', () => {
    expect(parsePr('no pull requests found')).toBeNull();
    expect(parsePr('{}')).toBeNull();
  });
});
