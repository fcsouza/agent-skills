import { describe, expect, test } from 'claude-code/testing';

import { addsEverything, findLeaks, LEAK_PARTS, pushTargets, splitCommands, stagesTracked } from './rules';

const home = `${LEAK_PARTS[0]}someone/project`;

describe('rules', () => {
  test('splitCommands finds git calls after cd and git -C', () => {
    const [first, second] = splitCommands('cd app && git -C sub commit -m "x && y"');
    expect(first?.git?.verb).toBe('commit');
    expect(first?.dir).toBe('app/sub');
    expect(second).toBeUndefined();
  });

  test('splitCommands skips env assignments and git options', () => {
    const [only] = splitCommands('GIT_EDITOR=true git -c core.x=1 push origin main');
    expect(only?.git).toEqual({ verb: 'push', args: ['origin', 'main'] });
  });

  test('addsEverything catches -A, --all, . and combined flags', () => {
    expect(addsEverything(['-A'])).toBe(true);
    expect(addsEverything(['.'])).toBe(true);
    expect(addsEverything(['-vA'])).toBe(true);
    expect(addsEverything(['src/a.ts', 'README.md'])).toBe(false);
  });

  test('stagesTracked reads -a, -am and --all', () => {
    expect(stagesTracked(['-am', 'msg'])).toBe(true);
    expect(stagesTracked(['-m', 'msg'])).toBe(false);
  });

  test('findLeaks reports added lines only, with their file', () => {
    const diff = ['+++ b/bun.lock', `+  "dep": "link:${home}",`, `-  "old": "${home}",`, '+++ b/a.ts', '+const ok = 1'].join('\n');
    expect(findLeaks(diff)).toEqual([{ file: 'bun.lock', line: `"dep": "link:${home}",` }]);
  });

  test('pushTargets resolves refspecs and a bare push', () => {
    expect(pushTargets([], 'main')).toEqual(['main']);
    expect(pushTargets(['-u', 'origin', 'feat/x'], 'feat/x')).toEqual(['feat/x']);
    expect(pushTargets(['origin', 'HEAD:refs/heads/master'], 'feat/x')).toEqual(['master']);
    expect(pushTargets(['origin', '+feat:main'], 'feat')).toEqual(['main']);
    expect(pushTargets(['--all', 'origin'], 'feat')).toContain('main');
  });
});
