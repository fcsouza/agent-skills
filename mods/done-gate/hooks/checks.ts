// Which checks a project has, and which shell commands count as running them.

export type Check = 'format' | 'lint' | 'typecheck' | 'test';

export const CHECKS: readonly Check[] = ['format', 'lint', 'typecheck', 'test'];

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|json|jsonc|css|scss|vue|svelte|astro)$/;

export const isCodeFile = (path: string): boolean => CODE_FILE.test(path) && !/(^|\/)(bun\.lock|package-lock\.json)$/.test(path);

const RUNS: Record<Check, RegExp> = {
  format: /\b(bun run (format|fmt)\b|ultracite (fix|format)\b|biome (format|check)\b.*--write)/,
  lint: /\b(bun run (lint|lint:\S+|check)\b|ultracite (lint|check)\b|biome (lint|check)\b|eslint\b)/,
  typecheck: /\b(bun run (typecheck|type-check|tsc|check-types|types)\b|tsc\b|bunx tsc\b|vue-tsc\b)/,
  test: /\b(bun (run )?test\b|vitest\b|jest\b|playwright test\b)/,
};

/** The checks a command line runs. */
export function checksIn(command: string): Check[] {
  return CHECKS.filter(check => RUNS[check].test(command));
}

/** The checks a package.json offers through its scripts. */
export function checksOffered(packageJson: string): Check[] {
  let scripts: Record<string, unknown> = {};
  try {
    scripts = (JSON.parse(packageJson) as { scripts?: Record<string, unknown> }).scripts ?? {};
  } catch {
    return [];
  }
  const names = Object.keys(scripts);
  const has = (pattern: RegExp) => names.some(name => pattern.test(name));
  return CHECKS.filter(check => {
    if (check === 'format') return has(/^(format|fmt)$/);
    if (check === 'lint') return has(/^lint(:|$)|^check$/);
    if (check === 'typecheck') return has(/^(typecheck|type-check|tsc|check-types|types)$/);
    return has(/^test(:|$)/);
  });
}
