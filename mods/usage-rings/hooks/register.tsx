import type { EngineInterface, Register, Timer } from 'claude-code';

import {
  type AgentRun,
  applyProgress,
  elapsed,
  isRunning,
  LINGER_MS,
  MAX_ROWS,
  modelLabel,
  PROGRESS_BRIEF,
  type ProgressInput,
  progressBar,
  sweepBar,
  visible,
} from './agents';
import { colorOf, isNarrow, type Meter, metersOf, ringOf } from './meters';

const REFRESH_MS = 30_000;

let meters: Meter[] = [];
let timer: Timer | undefined;
// The action a button started and that has not finished yet; its buttons hide meanwhile.
let running: 'compact' | 'review' | null = null;
const PROGRESS_TOOL = 'mcp__usage-rings__progress';
// Subagents this session started, newest last.
let agents: AgentRun[] = [];
// Redraws once a second while a subagent runs, so its clock moves.
let ticker: Timer | undefined;

function keepTicking($: EngineInterface): void {
  if (ticker === undefined && isRunning(agents)) {
    ticker = $.clock.every(1_000, () => {
      if (!isRunning(agents)) {
        ticker?.cancel();
        ticker = undefined;
      }
      $.ui.invalidate('ui.render');
    });
  }
}

// Done fills the bar; a reported plan fills it by steps; no plan sweeps while running.
function barOf(run: AgentRun, now: number): string {
  if (run.status === 'done') return progressBar(1, 1);
  if (run.stepTotal !== undefined) return progressBar(run.stepDone ?? 0, run.stepTotal);
  return run.status === 'running' ? sweepBar(now - run.startedAt) : progressBar(0, 1);
}

const STATUS_COLOR = { running: '#38bdf8', done: '#22c55e', failed: '#ef4444' } as const;

// `redraw: false` leaves the redraw to the ticker, which runs while any subagent does.
function updateAgent($: EngineInterface, agentId: string, change: (run: AgentRun) => AgentRun, redraw = true): void {
  agents = agents.map(run => (run.agentId === agentId ? change(run) : run));
  if (redraw) $.ui.invalidate('ui.render');
}

// Runs a slash command as if typed. With `submitOnFailure`, a command the engine will not
// run directly (a skill) is submitted as the user's prompt instead; /compact never is, so a
// compaction that fails is not started twice.
// Work a press starts is cancelled when the press ends, so a timer starts the command in
// a dispatch of its own that lasts until the command ends.
function runCommand($: EngineInterface, action: 'compact' | 'review', command: string, args = '', submitOnFailure = false): void {
  running = action;
  $.ui.invalidate('ui.render');
  $.clock.after(1, () =>
    $.command
      .run({ command, args })
      .catch((error: unknown) => {
        if (!submitOnFailure) throw error;
        return $.prompt.submit({ text: `/${command}${args === '' ? '' : ` ${args}`}`, asUser: true });
      })
      .catch((error: unknown) => $.ui.toast(`/${command} failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        running = null;
        $.ui.invalidate('ui.render');
      }),
  );
}

async function refresh($: EngineInterface): Promise<void> {
  const [usage, now] = await Promise.all([$.session.usage(), $.clock.now()]);
  meters = metersOf(usage, now);
  $.ui.invalidate('ui.render');
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await $.tool
      .register({
        name: 'progress',
        description:
          'For subagents: report progress on your own task to the bar above the prompt. ' +
          'Right after reading your task, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
          'call it again as each step finishes. Cheap and silent: it only draws a bar.',
        inputSchema: {
          type: 'object',
          properties: {
            done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
            total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
            note: { type: 'string', description: 'The step in progress, a few words.' },
          },
          required: ['done'],
        },
        // In every agent's tool list, not behind ToolSearch: subagents do not go looking for it.
        isDeferred: false,
      })
      .catch(() => undefined);
    await refresh($).catch(() => undefined);
    timer?.cancel();
    timer = $.clock.every(REFRESH_MS, () => {
      refresh($).catch(() => undefined);
    });
    return started;
  });

  on('turn.complete', async ($, e, next) => {
    const done = await next(e);
    const agentId = e.agentId;
    if (agentId !== undefined) {
      const at = await $.clock.now();
      updateAgent($, agentId, run => ({ ...run, status: e.reason === 'answer' ? 'done' : 'failed', endedAt: at }));
      // Redraw once the row's linger time is over, so it leaves the band.
      $.clock.after(LINGER_MS + 50, () => $.ui.invalidate('ui.render'));
    }
    await refresh($).catch(() => undefined);
    return done;
  });

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e.prompt.includes(PROGRESS_BRIEF) ? e : { ...e, prompt: e.prompt + PROGRESS_BRIEF });
    if (started.deny !== undefined || started.agentId === undefined) {
      return started;
    }
    const at = await $.clock.now();
    const run: AgentRun = {
      agentId: started.agentId,
      description: e.description || e.subagentType,
      model: started.model,
      status: 'running',
      startedAt: at,
      tools: 0,
    };
    agents = [...visible(agents, at).filter(other => other.agentId !== run.agentId), run];
    $.ui.invalidate('ui.render');
    keepTicking($);
    return started;
  }).catch(($, e, next) => next(e));

  // Answers the progress tool itself: nothing runs, the report only moves the subagent's bar.
  on('tool.call', { tool: PROGRESS_TOOL }, async ($, e) => {
    const agentId = e.agentId;
    if (agentId === undefined || !agents.some(run => run.agentId === agentId)) {
      return { result: 'ignored: only subagents report progress' };
    }
    updateAgent($, agentId, run => applyProgress(run, e as ProgressInput));
    return { result: 'ok' };
  }).catch(() => ({ result: 'ignored: the progress bar failed' }));

  // Counts each subagent's tool calls: the closest a plain subagent comes to saying how far along it is.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId;
    if (agentId !== undefined && e.tool !== PROGRESS_TOOL && agents.some(run => run.agentId === agentId)) {
      updateAgent($, agentId, run => ({ ...run, tools: run.tools + 1 }), false);
    }
    return next(e);
  }).catch(($, e, next) => next(e));

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e);
    if (e.props.hasSurvey) {
      return below;
    }
    const { Box, Button, Text } = $.ui.resolve(e);
    const canAct = !e.props.isWorking && running === null;
    const now = await $.clock.now();
    const shown = visible(agents, now);
    // Narrow: no reset countdowns, buttons on their own line, shorter agent rows.
    const narrow = isNarrow(e.viewport?.columns);
    const buttons = canAct ? (
      <Box gap={1}>
        <Button key="compact" label="Compact" onPress={() => runCommand($, 'compact', 'compact')} />
        <Button key="review" label={narrow ? 'Review' : 'Code review'} onPress={() => runCommand($, 'review', 'code-review', 'high --fix', true)} />
      </Box>
    ) : null;
    return (
      <Box flexDirection="column">
        <Box gap={narrow ? 2 : 3} justifyContent="center" flexWrap="wrap">
          {meters.map(meter => (
            <Box gap={1}>
              <Text color={colorOf(meter.percent)}>{ringOf(meter.percent)}</Text>
              <Text bold color={colorOf(meter.percent)}>
                {meter.percent}%
              </Text>
              <Text dimColor>
                {meter.label}
                {meter.resets === undefined || narrow ? '' : ` · ${meter.resets}`}
              </Text>
            </Box>
          ))}
          {narrow ? null : buttons}
        </Box>
        {narrow && buttons !== null ? <Box justifyContent="center">{buttons}</Box> : null}
        {shown.slice(-MAX_ROWS).map(run => (
          <Box gap={1}>
            <Text color={STATUS_COLOR[run.status]}>{run.status === 'running' ? '●' : run.status === 'done' ? '✓' : '✗'}</Text>
            <Text wrap="truncate-end">{run.description}</Text>
            <Text color={STATUS_COLOR[run.status]}>{barOf(run, now)}</Text>
            {run.stepTotal !== undefined ? <Text>{`${run.stepDone ?? 0}/${run.stepTotal}`}</Text> : null}
            <Text dimColor wrap="truncate-end">
              {narrow
                ? `${modelLabel(run.model)} · ${elapsed((run.endedAt ?? now) - run.startedAt)}`
                : `${run.stepNote !== undefined && run.status === 'running' ? `${run.stepNote} · ` : ''}${modelLabel(run.model)} · ${elapsed((run.endedAt ?? now) - run.startedAt)} · ${run.tools} tool${run.tools === 1 ? '' : 's'}`}
            </Text>
          </Box>
        ))}
        {shown.length > MAX_ROWS ? <Text dimColor>{`+${shown.length - MAX_ROWS} more`}</Text> : null}
        {below}
      </Box>
    );
  });
};
