// Verified against: better-auth 1.7.23 (2026-11-14)
// Keeps moderators away from staff accounts. The admin plugin checks only the
// caller's permission, never the target's role, so without this a moderator
// with `user: ['ban']` could ban an admin.
//
// It denies by default. On every /admin/* path outside ALLOWED_PATHS, a caller
// who is not an admin must name a target user, and every role of that target
// must be `player`. Anything else is refused.
//
// Install it as a plugin: `plugins: [admin(...), staffGuard()]`. A plugin hook
// does not use up the single `hooks.before` slot. If a project must call
// `guardStaffTargets(ctx)` from its own hook instead, `await` it as the first
// statement, do not catch its error, and do not rewrite the body of /admin/*
// requests in any hook.
import type { BetterAuthPlugin } from 'better-auth';
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from 'better-auth/api';
import { rolesOf } from './role-definitions';

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

// The admin plugin's own settings that decide who is an admin. Its
// hasPermission treats every id in `adminUserIds` as an admin, and a user with
// no role as `defaultRole` (the plugin's default is `user`).
const adminSettings = (ctx: HookContext) => {
  const options = ctx.context.options.plugins?.find(
    (plugin) => plugin.id === 'admin',
  )?.options;
  const ids: unknown = options?.adminUserIds;
  const defaultRole: unknown = options?.defaultRole;
  return {
    adminUserIds: Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [],
    defaultRole:
      typeof defaultRole === 'string' && defaultRole ? defaultRole : 'user',
  };
};

const roleOf = (user: object): unknown => ('role' in user ? user.role : undefined);

// Every before hook gets the request's original headers: in 1.7.23
// (dist/api/dispatch.mjs, runBeforeHooks) header changes merge only after the
// last before hook. So the bearer plugin's token-to-cookie swap is invisible
// here, wherever this guard sits. Run bearer's own hook to read the session
// the endpoint will read.
const endpointHeaders = async (ctx: HookContext) => {
  let headers = ctx.headers;
  const bearer = ctx.context.options.plugins?.find(
    (plugin) => plugin.id === 'bearer',
  );
  for (const hook of bearer?.hooks?.before ?? []) {
    if (!hook.matcher(ctx)) continue;
    const result: unknown = await hook.handler({ ...ctx, returnHeaders: true });
    const swapped =
      typeof result === 'object' &&
      result !== null &&
      'response' in result &&
      typeof result.response === 'object' &&
      result.response !== null &&
      'context' in result.response &&
      typeof result.response.context === 'object' &&
      result.response.context !== null &&
      'headers' in result.response.context
        ? result.response.context.headers
        : undefined;
    if (swapped instanceof Headers) headers = swapped;
  }
  return headers;
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

  // Server code calling auth.api.createUser({ body }) with no headers and no
  // request: the plugin allows it without a session. Every other guarded path
  // runs the plugin's adminMiddleware, which refuses a call with no session.
  if (ctx.path === '/admin/create-user' && !ctx.request && !ctx.headers) return;

  // Read the caller as the plugin does: from the session store, not the
  // cookie cache, so a demotion takes effect at once.
  const caller = await getAuthoritativeSessionFromCtx({
    ...ctx,
    headers: await endpointHeaders(ctx),
  });
  if (!caller) {
    throw new APIError('UNAUTHORIZED', { message: 'Sign in first.' });
  }
  const { adminUserIds, defaultRole } = adminSettings(ctx);
  if (
    adminUserIds.includes(caller.user.id) ||
    rolesOf(roleOf(caller.user), defaultRole).includes('admin')
  ) {
    return;
  }

  // Fail closed: the target must exist and be a player and nothing else.
  const userId = await targetUserId(ctx);
  if (!userId) return forbid();
  const target = await ctx.context.internalAdapter.findUserById(userId);
  if (
    !target ||
    adminUserIds.includes(target.id) ||
    !rolesOf(roleOf(target), defaultRole).every((name) => name === 'player')
  ) {
    return forbid();
  }
};

// List it in `plugins` after admin(). Its order relative to bearer() does not
// matter, because guardStaffTargets runs bearer's hook itself.
export const staffGuard = () =>
  ({
    id: 'staff-guard',
    hooks: {
      before: [
        {
          matcher: (context) => context.path?.startsWith('/admin/') ?? false,
          handler: createAuthMiddleware(guardStaffTargets),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
