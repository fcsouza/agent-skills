// Verified against: better-auth 1.7.23 (2026-11-14)
// Game roles for the Better Auth admin plugin: player, moderator, admin.
// Pass `ac` and `roles` to admin() on the server and adminClient() on the client,
// and set `defaultRole: 'player'`, or new users get the plugin's default role "user",
// which this file does not define.
import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
} from 'better-auth/plugins/admin/access';

// Resources and the actions a role may take on them. `user` and `session` come
// from the admin plugin; its endpoints check them (unban checks user "ban",
// role changes check user "set-role").
export const statement = {
  ...defaultStatements,
  match: ['join', 'create', 'end'],
  chat: ['send', 'delete'],
  report: ['create', 'read', 'resolve'],
  gameConfig: ['read', 'update'],
  analytics: ['read'],
} as const;

export const ac = createAccessControl(statement);

// Plays, chats, reports others. No admin-plugin permissions.
export const player = ac.newRole({
  match: ['join', 'create'],
  chat: ['send'],
  report: ['create'],
});

// Keeps matches and chat clean: bans and unbans players, ends matches,
// deletes messages, works the report queue. Cannot change roles or game config.
// The admin plugin does not check the target's role: install `staffGuard`
// (staff-guard.ts) so these user and session powers reach players only.
export const moderator = ac.newRole({
  user: ['list', 'get', 'ban'],
  session: ['list', 'revoke'],
  match: ['join', 'create', 'end'],
  chat: ['send', 'delete'],
  report: ['create', 'read', 'resolve'],
  gameConfig: ['read'],
  analytics: ['read'],
});

// Everything the admin plugin allows (including set-role), plus all game actions.
export const admin = ac.newRole({
  ...adminAc.statements,
  match: ['join', 'create', 'end'],
  chat: ['send', 'delete'],
  report: ['create', 'read', 'resolve'],
  gameConfig: ['read', 'update'],
  analytics: ['read'],
});

export const roles = { player, moderator, admin };
export type GameRole = keyof typeof roles;

type PermissionRequest = Parameters<typeof player.authorize>[0];

const isGameRole = (name: string): name is GameRole => name in roles;

// Synchronous check against the matrix, for code that already holds the
// session user. `user.role` is a comma-separated list when a user has several
// roles. An unknown or missing role grants nothing.
export const can = (
  userRole: string | null | undefined,
  request: PermissionRequest,
): boolean =>
  (userRole ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(isGameRole)
    .some((name) => roles[name].authorize(request).success);

// Ownership is not a role permission. A player edits their own profile,
// inventory and settings because the session user id matches the owner id.
export const isOwner = (sessionUserId: string, ownerId: string): boolean =>
  sessionUserId === ownerId;
