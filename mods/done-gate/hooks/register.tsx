import type { EngineInterface, Register } from 'claude-code';

import { type Check, checksIn, checksOffered, isCodeFile } from './checks';

// Files edited since the checks last all passed, and when each check last passed.
const edited = new Map<string, number>();
const passedAt = new Map<Check, number>();
let offered: Check[] = [];
let editedAt = 0;

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Check names for a narrow band.
const SHORT: Record<Check, string> = { format: 'fmt', lint: 'lint', typecheck: 'tsc', test: 'test' };

async function loadOffered($: EngineInterface): Promise<void> {
  const cwd = await $.session.cwd();
  const file = await $.fs.read(`${cwd}/package.json`).catch(() => null);
  offered = file === null ? [] : checksOffered(file);
}

const missing = (): Check[] => offered.filter(check => (passedAt.get(check) ?? 0) < editedAt);

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await loadOffered($);
    return started;
  });

  on('tool.call', async ($, e, next) => {
    const ran = await next(e);
    if (ran.deny !== undefined || ran.isError === true) {
      return ran;
    }

    if (EDIT_TOOLS.has(e.tool)) {
      const input = e as { file_path?: unknown; notebook_path?: unknown };
      const path = String(input.file_path ?? input.notebook_path ?? '');
      if (isCodeFile(path)) {
        editedAt = await $.clock.now();
        edited.set(path, editedAt);
        $.ui.invalidate('ui.render');
      }
      return ran;
    }

    if (e.tool === 'Bash') {
      const command = String((e as { command?: unknown }).command ?? '');
      const checks = checksIn(command);
      if (checks.length > 0) {
        const at = await $.clock.now();
        for (const check of checks) passedAt.set(check, at);
        if (missing().length === 0) edited.clear();
        $.ui.invalidate('ui.render');
      }
      if (/package\.json/.test(command)) await loadOffered($);
    }
    return ran;
  }).catch(($, e, next) => next(e));

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e);
    if (e.props.hasSurvey) {
      return below;
    }
    const owed = missing();
    if (edited.size === 0 || owed.length === 0) {
      return below;
    }

    const { Box, Button, Text } = $.ui.resolve(e);
    const narrow = (e.viewport?.columns ?? Number.POSITIVE_INFINITY) < 80;
    return (
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          <Text color="#f59e0b">●</Text>
          <Text>{narrow ? `${edited.size} edited` : `${edited.size} file${edited.size === 1 ? '' : 's'} edited`}</Text>
          {offered.map(check => (
            <Text color={owed.includes(check) ? '#ef4444' : '#22c55e'}>
              {owed.includes(check) ? '✗' : '✓'} {narrow ? SHORT[check] : check}
            </Text>
          ))}
          <Button
            key="dismiss"
            label="Dismiss"
            onPress={() => {
              edited.clear();
              $.ui.invalidate('ui.render');
            }}
          />
        </Box>
        {below}
      </Box>
    );
  });
};
