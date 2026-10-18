// Rewrites package-manager commands to bun. Pure, so the tests call it directly.

// A command starts at a line's start or after &&, ||, ; or |. The tool name must
// end at a space or the segment's end, so `npm-check-updates` is left alone.
const SEGMENT = /(^|&&|\|\||;|\|)([ \t]*)((?:npm|npx|yarn|pnpm)(?=[ \t]|$|[&|;])[^&|;\n]*|bunx[ \t]+(?:@biomejs\/)?biome(?=[ \t]|$)[^&|;\n]*)/gm;

// Package-manager commands with no bun spelling here: run as written.
const BUILTINS = new Set([
  'publish',
  'pack',
  'version',
  'view',
  'info',
  'why',
  'outdated',
  'upgrade',
  'up',
  'update',
  'link',
  'unlink',
  'audit',
  'login',
  'logout',
  'whoami',
  'config',
  'workspace',
  'workspaces',
  'cache',
  'store',
  'global',
  'patch',
  'dedupe',
  'prune',
  'licenses',
  'env',
  'set',
  'import',
]);

export function rewrite(command: string): string {
  return command.replace(SEGMENT, (_all, sep: string, space: string, body: string) => `${sep}${space}${rewriteOne(body.trimEnd())}${trailing(body)}`);
}

const trailing = (body: string): string => body.slice(body.trimEnd().length);

function rewriteOne(body: string): string {
  const [tool = '', ...rest] = body.split(/\s+/);
  const [sub, ...args] = rest;

  if (tool === 'bunx') {
    // bunx biome format --write / check --write fix; anything else only checks.
    return /\b(format|check|lint)\b.*--write\b/.test(body) ? 'bun run format' : 'bun run lint:biome';
  }
  if (tool === 'npx' || (tool === 'pnpm' && sub === 'dlx') || (tool === 'yarn' && sub === 'dlx')) {
    const tail = tool === 'npx' ? rest : args;
    return ['bunx', ...tail.filter(arg => arg !== '-y' && arg !== '--yes')].join(' ');
  }

  if (sub === undefined || sub === 'install' || sub === 'i' || sub === 'ci') {
    const packages = args.filter(arg => !arg.startsWith('-'));
    if (sub === undefined || packages.length === 0) {
      return ['bun', 'install', ...flags(args)].join(' ');
    }
    return ['bun', 'add', ...flags(args), ...packages].join(' ');
  }
  if (sub === 'add') {
    return ['bun', 'add', ...flags(args), ...args.filter(arg => !arg.startsWith('-'))].join(' ');
  }
  if (sub === 'uninstall' || sub === 'remove' || sub === 'rm' || sub === 'un') {
    return ['bun', 'remove', ...args].join(' ');
  }
  if (sub === 'run' || sub === 'run-script') {
    return ['bun', 'run', ...args].join(' ');
  }
  if (sub === 'exec') {
    return ['bunx', ...args].join(' ');
  }
  if (sub === 'test' || sub === 't' || sub === 'start' || sub === 'build') {
    // `npm test` runs the "test" script; plain `bun test` would run bun's own runner.
    return ['bun', 'run', sub === 't' ? 'test' : sub, ...args].join(' ');
  }
  if (sub === 'create' || sub === 'init') {
    return args.length > 0 ? ['bun', 'create', ...args].join(' ') : 'bun init';
  }
  if ((tool === 'yarn' || tool === 'pnpm') && !sub.startsWith('-') && !BUILTINS.has(sub)) {
    // `yarn dev` / `pnpm dev` run a script.
    return ['bun', 'run', sub, ...args].join(' ');
  }
  return body;
}

/** npm/yarn/pnpm flags in bun's spelling; unknown flags are dropped. */
function flags(args: readonly string[]): string[] {
  const out: string[] = [];
  for (const arg of args) {
    if (arg === '-D' || arg === '--save-dev' || arg === '--dev') out.push('-d');
    else if (arg === '-g' || arg === '--global') out.push('-g');
    else if (arg === '-E' || arg === '--save-exact' || arg === '--exact') out.push('--exact');
    else if (arg === '--frozen-lockfile' || arg === '--immutable') out.push('--frozen-lockfile');
    else if (arg === '-O' || arg === '--save-optional' || arg === '--optional') out.push('--optional');
  }
  return out;
}
