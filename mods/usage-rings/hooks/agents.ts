// The subagents this session runs, as rows under the meters. Pure, so the tests call it directly.

export type AgentStatus = 'running' | 'done' | 'failed';

export type AgentRun = {
  agentId: string;
  description: string;
  model: string;
  status: AgentStatus;
  startedAt: number;
  endedAt?: number;
  tools: number;
  // Set once the subagent reports its plan through the progress tool.
  stepDone?: number;
  stepTotal?: number;
  stepNote?: string;
};

export type ProgressInput = { done?: unknown; total?: unknown; note?: unknown };

// Appended to every subagent's prompt so it reports a plan the band can draw as a real bar.
export const PROGRESS_BRIEF = `

Progress reporting: right after reading this task, call the \`progress\` tool with \`total\` (your plan in 3-8 steps) and \`done: 0\`, then call it again each time a step finishes, with a few-word \`note\` naming the next step. It only draws a bar for the user; it costs nothing and returns nothing useful. If you have no \`progress\` tool, ignore this paragraph.`;

const BAR_WIDTH = 8;

// How long a finished row stays before it leaves the band.
export const LINGER_MS = 8_000;
// Rows drawn at most; the rest are counted on one line.
export const MAX_ROWS = 5;

/** `claude-haiku-4-5-20251001` → `Haiku 4.5`; anything else as it came. */
export function modelLabel(model: string): string {
  const match = /claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?(?:-|\[|$)/.exec(model);
  if (match === null) {
    return model;
  }
  const [, family = '', major = '', minor] = match;
  return `${family[0]?.toUpperCase()}${family.slice(1)} ${major}${minor === undefined ? '' : `.${minor}`}`;
}

/** 9s, 1m05s, 1h02m. */
export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`;
  }
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
}

/** Drops finished rows older than LINGER_MS; running rows always stay. */
export function visible(runs: readonly AgentRun[], now: number): AgentRun[] {
  return runs.filter(run => run.status === 'running' || now - (run.endedAt ?? now) < LINGER_MS);
}

/** Applies a progress report, clamping done to the plan and dropping bad values. */
export function applyProgress(run: AgentRun, input: ProgressInput): AgentRun {
  const total = typeof input.total === 'number' && input.total >= 1 ? Math.round(input.total) : run.stepTotal;
  const doneRaw = typeof input.done === 'number' && input.done >= 0 ? Math.round(input.done) : (run.stepDone ?? 0);
  const note = typeof input.note === 'string' && input.note.trim() !== '' ? input.note.trim().slice(0, 60) : run.stepNote;
  return { ...run, stepTotal: total, stepDone: total === undefined ? doneRaw : Math.min(total, doneRaw), stepNote: note };
}

/** A filled bar for a known plan: ▰▰▰▱▱▱▱▱ */
export function progressBar(done: number, total: number): string {
  const filled = total <= 0 ? 0 : Math.round((Math.min(done, total) / total) * BAR_WIDTH);
  return '▰'.repeat(filled) + '▱'.repeat(BAR_WIDTH - filled);
}

/** A 3-cell block sweeping across the bar, one cell a second: for a subagent with no plan. */
export function sweepBar(elapsedMs: number): string {
  const span = BAR_WIDTH + 2;
  const head = Math.floor(elapsedMs / 1000) % span;
  return Array.from({ length: BAR_WIDTH }, (_, i) => (i <= head && i > head - 3 ? '▰' : '▱')).join('');
}

export const isRunning = (runs: readonly AgentRun[]): boolean => runs.some(run => run.status === 'running');
