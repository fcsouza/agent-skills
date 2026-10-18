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
};

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

export const isRunning = (runs: readonly AgentRun[]): boolean => runs.some(run => run.status === 'running');
