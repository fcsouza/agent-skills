import type { Register } from 'claude-code';

import { addedText, addsUnguardedTransport, hasDevGuard } from './rules';

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

export const register: Register = on => {
  on('tool.call', { tool: /^(Edit|Write|MultiEdit)$/ }, async ($, e, next) => {
    const input = e as { file_path?: unknown; content?: unknown; new_string?: unknown; edits?: unknown };
    const path = String(input.file_path ?? '');
    if (!SOURCE.test(path) || !addsUnguardedTransport(addedText(input))) {
      return next(e);
    }
    // An Edit lands inside existing code: a guard already in the file counts. A Write replaces the file, so only its own text does.
    if (e.tool !== 'Write') {
      const current = await $.fs.read(path).catch(() => '');
      if (hasDevGuard(current)) return next(e);
    }
    return {
      deny: `${$.plugin.name}: this adds a pino transport to ${path}. Under \`bun build\` its worker thread cannot load inlined modules and every log stream, stdout included, dies with no error. Use \`pino.multistream()\` with direct streams (for example @logtail/node) in production. A transport is fine only on the unbundled development path, behind \`isDevelopment()\`.`,
    };
  }).catch(($, e, next) => next(e));
};
