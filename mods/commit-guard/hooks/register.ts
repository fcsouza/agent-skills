import type { EngineInterface, Register } from 'claude-code';

import { addsEverything, findLeaks, pushTargets, resolveDir, splitCommands, stagesTracked } from './rules';

const PROTECTED_BRANCHES = new Set(['main', 'master']);

function git($: EngineInterface, cwd: string, args: readonly string[]) {
  return $.process.run(['git', '--no-optional-locks', '-C', cwd, ...args], { timeoutMs: 10_000 });
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const commands = splitCommands(e.command).filter(command => command.git !== null);
    if (commands.length === 0) {
      return next(e);
    }
    const sessionCwd = await $.session.cwd();

    for (const command of commands) {
      if (command.git === null) {
        continue;
      }
      const cwd = resolveDir(sessionCwd, command.dir);
      const { verb, args } = command.git;

      if (verb === 'add' && addsEverything(args)) {
        return {
          deny: `${$.plugin.name}: \`git add ${args.join(' ')}\` stages every file, unread. Stage the files by name, then read \`git status --short\` and \`git diff --cached\` before committing.`,
        };
      }

      if (verb === 'commit') {
        const diff = await git($, cwd, stagesTracked(args) ? ['diff', 'HEAD'] : ['diff', '--cached']);
        const leaks = findLeaks(diff.stdout);
        if (leaks.length > 0) {
          const shown = leaks
            .slice(0, 5)
            .map(leak => `  ${leak.file}: ${leak.line}`)
            .join('\n');
          return {
            deny: `${$.plugin.name}: the staged diff holds an absolute path from this machine (${leaks.length} line${leaks.length === 1 ? '' : 's'}):\n${shown}\nRemove the path, or leave that file out of the commit. A lockfile written by a local link needs a fresh install, not a version edit.`,
          };
        }
      }

      if (verb === 'push') {
        const head = await git($, cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
        const hit = pushTargets(args, head.stdout.trim()).find(target => PROTECTED_BRANCHES.has(target));
        if (hit !== undefined) {
          return {
            deny: `${$.plugin.name}: this pushes straight to \`${hit}\`. Push a branch and open a PR instead; only the user pushes to ${hit}.`,
          };
        }
      }
    }

    return next(e);
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: the guard failed, so the command did not run.` }));
};
