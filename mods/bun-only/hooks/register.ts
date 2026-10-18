import type { Register } from 'claude-code';

import { rewrite } from './rewrite';

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = rewrite(e.command);
    if (command === e.command) {
      return next(e);
    }

    const ran = await next({ ...e, command });
    if (ran.deny !== undefined) {
      return ran;
    }
    return { ...ran, context: [...(ran.context ?? []), `${$.plugin.name} ran \`${command}\` in place of \`${e.command}\`. This machine uses bun only.`] };
  }).catch(($, e, next) => next(e));
};
