import type { EngineInterface, Register, RenderInput } from 'claude-code';

import { classify, envDatabaseHost, hostsIn, isLocalHost, maskSecrets, type Risk } from './rules';

const PANE_ID = 'sql-guard';
const POLL_MS = 250;
const HOLD_LIMIT_MS = 10 * 60 * 1000;

type Held = { risk: Risk; command: string; target: string; decision: 'proceed' | 'cancel' | null; where: 'pane' | 'band' };

let held: Held | null = null;

// The database a command reaches: hosts it names, else DATABASE_URL in the project's .env files.
async function targetOf($: EngineInterface, command: string): Promise<string[]> {
  const named = hostsIn(command);
  if (named.length > 0) return named;
  const cwd = await $.session.cwd();
  for (const file of ['.env.local', '.env']) {
    const text = await $.fs.read(`${cwd}/${file}`).catch(() => null);
    const host = text === null ? undefined : envDatabaseHost(text);
    if (host !== undefined) return [host];
  }
  return [];
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const risk = classify(e.command);
    if (risk === null) return next(e);

    const hosts = await targetOf($, e.command);
    // Every host local: a development database, nothing to hold. No host found: assume it may be production.
    if (hosts.length > 0 && hosts.every(isLocalHost)) return next(e);

    while (held !== null) {
      if (next.signal.aborted) return { deny: `${$.plugin.name}: the turn was interrupted while another database write waited. Nothing ran.` };
      await $.clock.sleep(POLL_MS);
    }
    const mine: Held = {
      risk,
      command: maskSecrets(e.command).slice(0, 400),
      target: hosts.length > 0 ? hosts.join(', ') : 'unknown (no host in the command or .env)',
      decision: null,
      where: 'pane',
    };
    held = mine;

    let opened = { isPlaced: false };
    let outcome: 'proceed' | 'cancel' | 'timeout' | 'interrupted' = 'timeout';
    try {
      opened = await $.ui.open({ id: PANE_ID, title: 'Database write', focus: true });
      if (!opened.isPlaced) mine.where = 'band';
      $.ui.invalidate('ui.render');
      $.ui.toast(`${$.plugin.name}: ${risk.label} waits for your OK`);
      const startedAt = await $.clock.now();
      while (mine.decision === null && !next.signal.aborted && (await $.clock.now()) - startedAt <= HOLD_LIMIT_MS) {
        await $.clock.sleep(POLL_MS);
      }
      outcome = mine.decision ?? (next.signal.aborted ? 'interrupted' : 'timeout');
    } finally {
      if (opened.isPlaced) await $.ui.close({ id: PANE_ID }).catch(() => undefined);
      if (held === mine) held = null;
      $.ui.invalidate('ui.render');
    }

    if (outcome === 'proceed') return next(e);
    const why = { cancel: 'the user pressed Cancel', timeout: 'no answer within 10 minutes', interrupted: 'the turn was interrupted' }[outcome];
    return { deny: `${$.plugin.name}: the ${risk.label} against ${mine.target} did not run: ${why}. Do not retry it unless the user asks.` };
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: the guard failed, so the database command did not run.` }));

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, ($, e, next) => (held === null ? next(e) : draw($, e, held)));
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => (held === null || held.where !== 'band' ? next(e) : draw($, e, held)));
};

function draw($: EngineInterface, e: RenderInput<'Pane' | 'AbovePrompt'>, call: Held) {
  const { Box, Button, Text } = $.ui.resolve(e);
  const decide = (decision: 'proceed' | 'cancel') => () => {
    call.decision = decision;
    $.ui.invalidate('ui.render');
  };
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#ef4444" paddingX={1}>
      <Text bold color="#ef4444">
        Database write: {call.risk.label}
      </Text>
      <Text>Target: {call.target}</Text>
      <Text dimColor wrap="wrap">
        {call.command}
      </Text>
      <Box gap={1} marginTop={1}>
        <Button key="proceed" label="Proceed" onPress={decide('proceed')} />
        <Button key="cancel" label="Cancel" onPress={decide('cancel')} />
      </Box>
    </Box>
  );
}
