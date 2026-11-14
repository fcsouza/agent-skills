// Verified against: better-auth 1.7.23 (2026-11-14)
// Before hook that keeps moderators away from staff accounts. The admin plugin
// checks only the caller's permission, never the target's role, so without
// this a moderator could ban an admin or list an admin's sessions.
//
// It denies by default: on every /admin/* path outside ALLOWED_PATHS, a caller
// who is not an admin must name a target user, and that target must not be a
// moderator or admin. Review ALLOWED_PATHS when Better Auth adds admin endpoints.
//
// Better Auth takes one `hooks.before` middleware. If the project already has
// one, call `guardStaffTargets(ctx)` from it instead of passing `staffGuard`.
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

// Admin paths a non-admin may call without a target check.
// list-users and get-user return profile fields only (no sessions or tokens);
// has-permission and stop-impersonating act on the caller.
const ALLOWED_PATHS = new Set([
  '/admin/list-users',
  '/admin/get-user',
  '/admin/has-permission',
  '/admin/stop-impersonating',
]);

const STAFF_ROLES = new Set(['moderator', 'admin']);

// `role` is a comma-separated string added by the admin plugin.
const rolesOf = (user: object): string[] =>
  'role' in user && typeof user.role === 'string'
    ? user.role.split(',').map((name) => name.trim())
    : [];

// Mirrors the endpoints' `z.coerce.string()` on userId, so a numeric id
// cannot slip past the guard and still reach the endpoint.
const targetUserId = async (ctx: HookContext): Promise<string | null> => {
  const body: unknown = ctx.body;
  if (typeof body !== 'object' || body === null) return null;
  if ('userId' in body && body.userId !== undefined && body.userId !== null) {
    return String(body.userId);
  }
  if ('sessionToken' in body && typeof body.sessionToken === 'string') {
    const found = await ctx.context.internalAdapter.findSession(body.sessionToken);
    return found?.user.id ?? null;
  }
  return null;
};

const forbid = (): never => {
  throw new APIError('FORBIDDEN', {
    message: 'Moderators can act only on players.',
  });
};

export const guardStaffTargets = async (ctx: HookContext): Promise<void> => {
  if (!ctx.path.startsWith('/admin/') || ALLOWED_PATHS.has(ctx.path)) return;

  const caller = await getSessionFromCtx(ctx);
  if (!caller) {
    throw new APIError('UNAUTHORIZED', { message: 'Sign in first.' });
  }
  if (rolesOf(caller.user).includes('admin')) return;

  // Fail closed: no target we can identify means no access.
  const userId = await targetUserId(ctx);
  if (!userId) return forbid();
  const target = await ctx.context.internalAdapter.findUserById(userId);
  if (!target || rolesOf(target).some((name) => STAFF_ROLES.has(name))) {
    return forbid();
  }
};

// Pass as `hooks: { before: staffGuard }` in betterAuth().
export const staffGuard = createAuthMiddleware(guardStaffTargets);
