import type { EngineInterface, Register, RenderInput } from 'claude-code';

import { actionOf, describeInput, isWrite } from './rules';

const PANE_ID = 'prod-guard';
const POLL_MS = 250;
const HOLD_LIMIT_MS = 10 * 60 * 1000;

type Held = {
  action: string;
  lines: string[];
  decision: 'proceed' | 'cancel' | null;
  where: 'pane' | 'band';
};

// The call waiting for an answer, or null. One at a time.
let held: Held | null = null;

export const register: Register = on => {
  on('tool.call', { tool: /^mcp__dokploy__/ }, async ($, e, next) => {
    if (!isWrite(e.tool)) {
      return next(e);
    }

    while (held !== null) {
      if (next.signal.aborted) {
        return { deny: `${$.plugin.name}: the turn was interrupted while another production call waited. Nothing ran.` };
      }
      await $.clock.sleep(POLL_MS);
    }
    const mine: Held = { action: actionOf(e.tool), lines: describeInput(e as Record<string, unknown>), decision: null, where: 'pane' };
    held = mine;

    let opened = { isPlaced: false };
    let outcome: 'proceed' | 'cancel' | 'timeout' | 'interrupted' | 'error' = 'error';
    try {
      opened = await $.ui.open({ id: PANE_ID, title: 'Production write', focus: true });
      if (!opened.isPlaced) {
        mine.where = 'band';
      }
      $.ui.invalidate('ui.render');
      $.ui.toast(`${$.plugin.name}: ${mine.action} waits for your OK`);

      const startedAt = await $.clock.now();
      while (mine.decision === null) {
        if (next.signal.aborted) {
          break;
        }
        if ((await $.clock.now()) - startedAt > HOLD_LIMIT_MS) {
          break;
        }
        await $.clock.sleep(POLL_MS);
      }
      outcome = mine.decision ?? (next.signal.aborted ? 'interrupted' : 'timeout');
    } finally {
      if (opened.isPlaced) {
        await $.ui.close({ id: PANE_ID }).catch(() => undefined);
      }
      if (held === mine) {
        held = null;
      }
      $.ui.invalidate('ui.render');
    }

    if (outcome === 'proceed') {
      return next(e);
    }
    const why = {
      cancel: 'the user pressed Cancel',
      timeout: 'no answer within 10 minutes',
      interrupted: 'the turn was interrupted',
      error: 'the guard hit an error',
    }[outcome];
    return { deny: `${$.plugin.name}: ${mine.action} did not run: ${why}. Do not retry it unless the user asks.` };
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: the guard failed, so the production call did not run.` }));

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
    <Box flexDirection="column" borderStyle="round" borderColor="#f97316" paddingX={1}>
      <Text bold color="#f97316">
        Dokploy write: {call.action}
      </Text>
      {call.lines.map(line => (
        <Text dimColor>{line}</Text>
      ))}
      <Box gap={1} marginTop={1}>
        <Button key="proceed" label="Proceed" onPress={decide('proceed')} />
        <Button key="cancel" label="Cancel" onPress={decide('cancel')} />
      </Box>
    </Box>
  );
}
