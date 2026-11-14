// Server-side guards for player input. Pure functions: no imports, no clock
// reads. The caller passes the server's time (`nowMs`) in, so the client's
// clock never decides anything. Take `nowMs` from a monotonic clock
// (`performance.now()`), not `Date.now()`, which can jump backwards.
//
// Every number in PLACEHOLDER_LIMITS is a placeholder to tune for your game.
// None of them comes from a source.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GuardLimits {
  /** World units per second at full input. */
  maxSpeed: number;
  /** Distance between the server's position and a client's claimed position that is accepted without a correction. */
  positionTolerance: number;
  /** Claimed distance from the server's position that counts as a teleport and raises a flag. */
  teleportDistance: number;
  /** Longest input step one message may claim, in ms. */
  maxInputDtMs: number;
  /** Extra simulated time a client may run ahead of server wall time, in ms (absorbs jitter). */
  clockSlackMs: number;
  /** Most unused wall time a client may bank while idle and spend later, in ms. */
  maxBankMs: number;
  /** Furthest back the server rewinds for lag compensation, in ms. */
  maxRewindMs: number;
}

/** Placeholders. Tune each value against your own game and network measurements. */
export const PLACEHOLDER_LIMITS: GuardLimits = {
  maxSpeed: 5,
  positionTolerance: 0.25,
  teleportDistance: 3,
  maxInputDtMs: 100,
  clockSlackMs: 250,
  maxBankMs: 500,
  maxRewindMs: 200,
};

export type Flag = 'non_finite' | 'stale_sequence' | 'teleport' | 'clock_ahead' | 'rewind_clamped';

const finite = (...values: number[]) => values.every(Number.isFinite);

/**
 * Sequence numbers must rise. A repeated or lower number is a duplicate or a
 * replayed input: drop it. Returns the new last sequence, or null to drop.
 * Sequence numbers must not wrap: the client sends an unbounded integer,
 * starting above the connection's initial lastSeq, never a counter that
 * rolls over to 0.
 */
export function acceptSequence(lastSeq: number, seq: number): number | null {
  if (!Number.isInteger(lastSeq) || !Number.isInteger(seq) || seq <= lastSeq) return null;
  return seq;
}

/**
 * Per-connection budget of simulated time. A client that claims more input
 * time than has passed on the server clock (plus slack) is running fast:
 * speed hack or a broken client. Create one per connection when it opens.
 */
export interface TimeBudget {
  startedAtMs: number;
  consumedMs: number;
}

export function createTimeBudget(nowMs: number): TimeBudget {
  return { startedAtMs: nowMs, consumedMs: 0 };
}

export type DtResult = { ok: true; dtMs: number } | { ok: false; flag: Flag };

/**
 * Clamps the step a client claims for one input to [0, maxInputDtMs] and
 * charges it to the budget. Refuses the input when the budget would run
 * ahead of server wall time by more than clockSlackMs. Idle time banks only
 * up to maxBankMs, so a client cannot idle and then burst many inputs into
 * one tick.
 */
export function consumeInputTime(
  budget: TimeBudget,
  claimedDtMs: number,
  nowMs: number,
  limits: GuardLimits,
): DtResult {
  if (!finite(claimedDtMs, nowMs)) return { ok: false, flag: 'non_finite' };
  const dtMs = Math.min(Math.max(claimedDtMs, 0), limits.maxInputDtMs);
  const wallMs = nowMs - budget.startedAtMs;
  budget.consumedMs = Math.max(budget.consumedMs, wallMs - limits.maxBankMs);
  if (budget.consumedMs + dtMs > wallMs + limits.clockSlackMs) {
    return { ok: false, flag: 'clock_ahead' };
  }
  budget.consumedMs += dtMs;
  return { ok: true, dtMs };
}

/**
 * Re-simulates one movement input on the server. The client sends a
 * direction, never a position. The direction is capped at length 1, so a
 * client cannot move faster by sending a longer vector, and the result stays
 * inside the world bounds. Pass the dtMs that consumeInputTime returned,
 * never the raw step the client claimed.
 */
export function simulateMove(
  position: Vec2,
  direction: Vec2,
  dtMs: number,
  limits: GuardLimits,
  bounds: Bounds,
): Vec2 | null {
  if (!finite(position.x, position.y, direction.x, direction.y, dtMs) || dtMs < 0) return null;
  const length = Math.hypot(direction.x, direction.y);
  const scale = length > 1 ? 1 / length : 1;
  const step = (limits.maxSpeed * dtMs) / 1000;
  return {
    x: Math.min(Math.max(position.x + direction.x * scale * step, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(position.y + direction.y * scale * step, bounds.minY), bounds.maxY),
  };
}

export type ClaimResult =
  | { verdict: 'accept'; position: Vec2 }
  | { verdict: 'correct'; position: Vec2; flag?: Flag };

/**
 * Compares a client's predicted end position with the server's result. The
 * server's position always wins. Within tolerance, no correction is sent.
 * Beyond it, send a correction; beyond teleportDistance, also record a flag.
 */
export function checkClaimedPosition(serverPosition: Vec2, claimed: Vec2, limits: GuardLimits): ClaimResult {
  if (!finite(claimed.x, claimed.y)) return { verdict: 'correct', position: serverPosition, flag: 'non_finite' };
  const error = Math.hypot(claimed.x - serverPosition.x, claimed.y - serverPosition.y);
  if (error <= limits.positionTolerance) return { verdict: 'accept', position: serverPosition };
  if (error > limits.teleportDistance) return { verdict: 'correct', position: serverPosition, flag: 'teleport' };
  return { verdict: 'correct', position: serverPosition };
}

export interface ClampedTime {
  timeMs: number;
  flag?: Flag;
}

/**
 * Clamps the time a client claims for an action (for example a shot, for
 * lag compensation) to [nowMs - rewindMs, nowMs]. rewindMs is the smaller of
 * maxRewindMs and this connection's allowed rewind: its measured round-trip
 * time plus the interpolation delay its client renders remote players with.
 * Round-trip, not one-way, is this skill's choice: it is what the server can
 * measure (ping to pong), and it over-allows rather than clamping honest
 * shots. The argument is required, so a caller cannot fall back to the full
 * cap by forgetting it.
 */
export function clampClaimedTime(
  claimedMs: number,
  nowMs: number,
  limits: GuardLimits,
  connectionRewindMs: number,
): ClampedTime {
  if (!finite(claimedMs, nowMs, connectionRewindMs)) return { timeMs: nowMs, flag: 'non_finite' };
  const rewindMs = Math.min(limits.maxRewindMs, Math.max(connectionRewindMs, 0));
  const earliest = nowMs - rewindMs;
  if (claimedMs > nowMs) return { timeMs: nowMs, flag: 'rewind_clamped' };
  if (claimedMs < earliest) return { timeMs: earliest, flag: 'rewind_clamped' };
  return { timeMs: claimedMs };
}

/**
 * Per-connection message cap: a token bucket held in memory, since one socket
 * lives on one server instance. Refill and capacity are placeholders. A
 * non-finite argument refuses the message. If nowMs is earlier than the last
 * update, nothing refills and updatedAtMs stays put, so the same interval is
 * never refilled twice.
 */
export interface MessageBudget {
  tokens: number;
  updatedAtMs: number;
}

export function createMessageBudget(nowMs: number, capacity: number): MessageBudget {
  return { tokens: capacity, updatedAtMs: nowMs };
}

export function takeMessage(budget: MessageBudget, nowMs: number, capacity: number, refillPerSecond: number): boolean {
  if (!finite(nowMs, capacity, refillPerSecond)) return false;
  if (nowMs > budget.updatedAtMs) {
    const elapsedMs = nowMs - budget.updatedAtMs;
    budget.tokens = Math.min(capacity, budget.tokens + (elapsedMs * refillPerSecond) / 1000);
    budget.updatedAtMs = nowMs;
  }
  if (budget.tokens < 1) return false;
  budget.tokens -= 1;
  return true;
}
