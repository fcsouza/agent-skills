// Verified against: better-auth 1.7.23 (2026-11-14)
// Before hook that stops a moderator from banning, unbanning or revoking the
// sessions of another moderator or an admin. The admin plugin checks only the
// caller's permission, not the target's role. Admins pass unchecked.
//
// Better Auth takes one `hooks.before` middleware. If the project already has
// one, call `guardStaffTargets(ctx)` from it instead of passing `staffGuard`.
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

// Admin-plugin endpoints whose target must be a player when the caller is not an admin.
const GUARDED_PATHS = new Set([
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/revoke-user-sessions',
  '/admin/revoke-user-session',
]);

const STAFF_ROLES = new Set(['moderator', 'admin']);

// `role` is a comma-separated string added by the admin plugin.
const rolesOf = (user: object): string[] =>
  'role' in user && typeof user.role === 'string'
    ? user.role.split(',').map((name) => name.trim())
    : [];

const targetUserId = async (ctx: HookContext): Promise<string | null> => {
  const body: unknown = ctx.body;
  if (typeof body !== 'object' || body === null) return null;
  if ('userId' in body && typeof body.userId === 'string') return body.userId;
  if ('sessionToken' in body && typeof body.sessionToken === 'string') {
    const found = await ctx.context.internalAdapter.findSession(body.sessionToken);
    return found?.user.id ?? null;
  }
  return null;
};

export const guardStaffTargets = async (ctx: HookContext): Promise<void> => {
  if (!GUARDED_PATHS.has(ctx.path)) return;

  // No session: the admin endpoint rejects the call itself.
  const caller = await getSessionFromCtx(ctx);
  if (!caller || rolesOf(caller.user).includes('admin')) return;

  const userId = await targetUserId(ctx);
  if (!userId) return;
  const target = await ctx.context.internalAdapter.findUserById(userId);
  if (target && rolesOf(target).some((name) => STAFF_ROLES.has(name))) {
    throw new APIError('FORBIDDEN', {
      message: 'Moderators can act only on players.',
    });
  }
};

// Pass as `hooks: { before: staffGuard }` in betterAuth().
export const staffGuard = createAuthMiddleware(guardStaffTargets);
