// Turns the session's usage into coloured meters. Pure, so the tests call it directly.

export type Meter = { label: string; percent: number; resets?: string };
export type UsageLike = {
  context: { percent?: number };
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[];
};

// Each level's colour: room to spare, worth watching, close, at the limit.
export const LEVELS = [
  { below: 50, color: '#22c55e' },
  { below: 75, color: '#eab308' },
  { below: 90, color: '#f97316' },
  { below: Number.POSITIVE_INFINITY, color: '#ef4444' },
] as const;

export const colorOf = (percent: number): string => LEVELS.find(level => percent < level.below)?.color ?? '#ef4444';

// A ring that fills by quarter: ○ ◔ ◑ ◕ ●
export const ringOf = (percent: number): string => ['○', '◔', '◑', '◕', '●'][Math.min(4, Math.max(0, Math.round(percent / 25)))] ?? '○';

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', seven_day_opus: '7d opus', seven_day_sonnet: '7d sonnet' };

export function metersOf(usage: UsageLike, now: number): Meter[] {
  const meters: Meter[] = [];
  if (usage.context.percent !== undefined) {
    meters.push({ label: 'context', percent: clamp(usage.context.percent) });
  }
  for (const limit of usage.rateLimits) {
    const resets = limit.resetsAt === undefined ? undefined : countdown(Date.parse(limit.resetsAt) - now);
    meters.push({
      label: LABELS[limit.kind] ?? limit.kind.replaceAll('_', ' '),
      percent: clamp(limit.percentUsed),
      ...(resets === undefined ? {} : { resets }),
    });
  }
  return meters;
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/** 2h05, 47m, or nothing once past. */
export function countdown(ms: number): string | undefined {
  if (!Number.isFinite(ms) || ms <= 0) {
    return undefined;
  }
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  if (days > 0) {
    return `${days}d${Math.floor((minutes % 1440) / 60)}h`;
  }
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`;
}

// Below this many columns the band switches to its compact form.
export const NARROW_COLUMNS = 80;

/** Narrow when the surface measured a width under NARROW_COLUMNS; wide when it measured none. */
export const isNarrow = (columns: number | undefined): boolean => columns !== undefined && columns < NARROW_COLUMNS;
