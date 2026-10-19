// Pure parsing for commit-guard: no `$`, so the tests can call it directly.

export type GitCall = { verb: string; args: string[] };
export type Command = { dir: string | null; git: GitCall | null };
export type Leak = { file: string; line: string };

// A path from this machine: a home folder, or a pnpm/npm link or file reference.
// Joined from pieces so this file never matches its own pattern in a diff.
export const LEAK_PARTS = ['/' + 'Users/', '/' + 'home/', 'link' + ':/', 'file' + ':/'];
const LEAK = new RegExp(LEAK_PARTS.map(part => part.replaceAll('/', '\\/')).join('|'));

// Options of `git` itself that take a value: `git -c k=v commit` skips both words.
const GIT_VALUE_OPTIONS = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace']);

/** Splits a shell line into words, keeping quoted runs together. Good enough for git commands. */
export function words(text: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
  for (const match of text.matchAll(re)) {
    out.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return out;
}

/**
 * Splits a command line on `&&`, `||`, `;` and `|`, and for each part reports the
 * folder a leading `cd dir` moved to and the git call it makes, if any.
 */
export function splitCommands(line: string): Command[] {
  const commands: Command[] = [];
  let dir: string | null = null;
  for (const part of splitOutsideQuotes(line)) {
    const ws = words(part.trim());
    if (ws[0] === 'cd' && ws[1] !== undefined) {
      dir = join(dir, ws[1]);
      continue;
    }
    commands.push(parseGit(ws, dir));
  }
  return commands;
}

/** Splits on `&&`, `||`, `;`, `|` and newlines that sit outside quotes. */
function splitOutsideQuotes(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? '';
    if (quote !== null) {
      current += char;
      if (char === '\\' && quote === '"') {
        current += line[i + 1] ?? '';
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    const pair = line.slice(i, i + 2);
    if (pair === '&&' || pair === '||') {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    if (char === ';' || char === '|' || char === '\n') {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function join(dir: string | null, next: string): string {
  return dir === null || next.startsWith('/') || next.startsWith('~') ? next : `${dir}/${next}`;
}

function parseGit(ws: string[], startDir: string | null): Command {
  let dir = startDir;
  const none = { dir, git: null };
  // Skip env assignments (`FOO=1 git ...`) and wrappers like `rtk`.
  let i = 0;
  while (i < ws.length && (/^[A-Z_][A-Z0-9_]*=/.test(ws[i] ?? '') || ws[i] === 'rtk' || ws[i] === 'command')) {
    i += 1;
  }
  if (ws[i] !== 'git') {
    return none;
  }
  i += 1;
  while (i < ws.length && (ws[i] ?? '').startsWith('-')) {
    const option = ws[i] ?? '';
    const value = ws[i + 1];
    if (option === '-C' && value !== undefined) {
      dir = join(dir, value);
    }
    i += GIT_VALUE_OPTIONS.has(option) ? 2 : 1;
  }
  const verb = ws[i];
  return verb === undefined ? { dir, git: null } : { dir, git: { verb, args: ws.slice(i + 1) } };
}

/** The folder a command runs in: the session folder, moved by `cd` or `git -C`. */
export function resolveDir(sessionCwd: string, dir: string | null): string {
  if (dir === null) {
    return sessionCwd;
  }
  return dir.startsWith('/') ? dir : `${sessionCwd}/${dir}`;
}

/** `git add -A`, `--all`, `.`, `:/` and `*` stage what nobody read. */
export function addsEverything(args: readonly string[]): boolean {
  return args.some(arg => arg === '-A' || arg === '--all' || arg === '.' || arg === ':/' || arg === '*' || /^-[a-zA-Z]*A[a-zA-Z]*$/.test(arg));
}

/** `git commit -a` / `-am` / `--all` stages tracked changes at commit time. */
export function stagesTracked(args: readonly string[]): boolean {
  return args.some(arg => arg === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(arg));
}

/** Added lines of a unified diff that hold a path from this machine. */
export function findLeaks(diff: string): Leak[] {
  const leaks: Leak[] = [];
  let file = '?';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line.slice(4).replace(/^b\//, '');
      continue;
    }
    if (line.startsWith('+') && LEAK.test(line)) {
      leaks.push({ file, line: line.slice(1).trim().slice(0, 160) });
    }
  }
  return leaks;
}

/**
 * The branches a `git push` would update: each refspec's destination, or the
 * current branch when the push names none.
 */
export function pushTargets(args: readonly string[], currentBranch: string): string[] {
  // --all and --mirror push every local branch, main included.
  if (args.some(arg => arg === '--all' || arg === '--mirror' || arg === '--branches')) {
    return ['main', 'master'];
  }
  const positional = args.filter(arg => !arg.startsWith('-'));
  const refspecs = positional.slice(1);
  if (refspecs.length === 0) {
    return [currentBranch];
  }
  return refspecs.map(spec => {
    const destination = spec.includes(':') ? spec.slice(spec.indexOf(':') + 1) : spec;
    const name = destination.replace(/^\+/, '').replace(/^refs\/heads\//, '');
    return name === 'HEAD' ? currentBranch : name;
  });
}

// `.env`, `.env.local`, `.env.production`, `foo/.env`... but not the templates meant to be shared.
const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/;
const ENV_TEMPLATE = /\.(example|sample|template|dist)$/;

export const isEnvFile = (path: string): boolean => ENV_FILE.test(path) && !ENV_TEMPLATE.test(path);

/** The .env files among `git diff --name-only` output, or among `git add` paths. */
export const envFilesIn = (paths: readonly string[]): string[] => paths.map(path => path.trim()).filter(path => path !== '' && isEnvFile(path));
