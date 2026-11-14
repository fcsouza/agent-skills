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

// Where each guarded endpoint reads its target, from the body schemas in
// better-auth 1.7.23 (dist/plugins/admin/routes.mjs). Read only that field:
// a request that also carries the other field must not sway the decision.
// Any other non-allowed /admin/* path has no entry and fails closed.
const TARGET_FIELD: Record<string, 'userId' | 'sessionToken'> = {
  '/admin/set-role': 'userId',
  '/admin/update-user': 'userId',
  '/admin/list-user-sessions': 'userId',
  '/admin/unban-user': 'userId',
  '/admin/ban-user': 'userId',
  '/admin/impersonate-user': 'userId',
  '/admin/revoke-user-sessions': 'userId',
  '/admin/remove-user': 'userId',
  '/admin/set-user-password': 'userId',
  '/admin/revoke-user-session': 'sessionToken',
};

const targetUserId = async (ctx: HookContext): Promise<string | null> => {
  const field = TARGET_FIELD[ctx.path];
  const body: unknown = ctx.body;
  if (!field || typeof body !== 'object' || body === null) return null;
  if (field === 'userId') {
    // The endpoints parse userId with z.coerce.string(); mirror it so a
    // numeric id cannot slip past the guard and still reach the endpoint.
    if (!('userId' in body) || body.userId === undefined || body.userId === null) {
      return null;
    }
    return String(body.userId);
  }
  // revoke-user-session parses sessionToken with z.string(): no coercion.
  if (!('sessionToken' in body) || typeof body.sessionToken !== 'string') return null;
  const found = await ctx.context.internalAdapter.findSession(body.sessionToken);
  return found?.user.id ?? null;
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
