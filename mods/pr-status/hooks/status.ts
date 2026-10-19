// Turns `gh pr view --json ...` output into what the band draws. Pure, so the tests call it directly.

export type Review = 'approved' | 'changes' | 'pending' | 'none';
export type PrStatus = { number: number; title: string; isDraft: boolean; state: string; pass: number; fail: number; running: number; review: Review };

export const GH_FIELDS = 'number,title,state,isDraft,reviewDecision,statusCheckRollup';

type Check = { status?: string; conclusion?: string; state?: string };

const FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const PASSED = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** One check's outcome: a CheckRun reads status/conclusion, a StatusContext reads state. */
function outcomeOf(check: Check): 'pass' | 'fail' | 'running' {
  const result = (check.conclusion ?? check.state ?? '').toUpperCase();
  if (check.status !== undefined && check.status.toUpperCase() !== 'COMPLETED') return 'running';
  if (FAILED.has(result)) return 'fail';
  if (PASSED.has(result)) return 'pass';
  return 'running';
}

const REVIEWS: Record<string, Review> = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes', REVIEW_REQUIRED: 'pending' };

/** Parses gh's JSON; null when there is no PR or the output is not what gh prints. */
export function parsePr(json: string): PrStatus | null {
  let data: { number?: unknown; title?: unknown; state?: unknown; isDraft?: unknown; reviewDecision?: unknown; statusCheckRollup?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data.number !== 'number') return null;
  const checks = Array.isArray(data.statusCheckRollup) ? (data.statusCheckRollup as Check[]) : [];
  const counts = { pass: 0, fail: 0, running: 0 };
  for (const check of checks) counts[outcomeOf(check)] += 1;
  return {
    number: data.number,
    title: typeof data.title === 'string' ? data.title : '',
    state: typeof data.state === 'string' ? data.state : 'OPEN',
    isDraft: data.isDraft === true,
    review: REVIEWS[String(data.reviewDecision ?? '')] ?? 'none',
    ...counts,
  };
}
