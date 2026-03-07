// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = ["player", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const ACTIONS = [
	"read",
	"create",
	"update",
	"delete",
	"ban",
	"unban",
	"promote",
	"demote",
	"manage",
] as const;
export type Action = (typeof ACTIONS)[number];

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const RESOURCES = [
	"own_profile",
	"own_inventory",
	"own_settings",
	"users",
	"game_sessions",
	"chat",
	"reports",
	"game_config",
	"analytics",
	"roles",
] as const;
export type Resource = (typeof RESOURCES)[number];

// ---------------------------------------------------------------------------
// Permission Map
// ---------------------------------------------------------------------------

type PermissionMap = Record<Role, Record<Resource, readonly Action[]>>;

export const PERMISSIONS: PermissionMap = {
	player: {
		own_profile: ["read", "update"],
		own_inventory: ["read", "create", "update", "delete"],
		own_settings: ["read", "update"],
		users: ["read"],
		game_sessions: ["read", "create"],
		chat: ["read", "create"],
		reports: ["create"],
		game_config: [],
		analytics: [],
		roles: [],
	},

	moderator: {
		own_profile: ["read", "update"],
		own_inventory: ["read", "create", "update", "delete"],
		own_settings: ["read", "update"],
		users: ["read", "ban", "unban"],
		game_sessions: ["read", "create", "delete"],
		chat: ["read", "create", "delete"],
		reports: ["read", "create", "update"],
		game_config: ["read"],
		analytics: ["read"],
		roles: [],
	},

	admin: {
		own_profile: ["read", "update"],
		own_inventory: ["read", "create", "update", "delete"],
		own_settings: ["read", "update"],
		users: [
			"read",
			"create",
			"update",
			"delete",
			"ban",
			"unban",
			"promote",
			"demote",
		],
		game_sessions: ["read", "create", "update", "delete", "manage"],
		chat: ["read", "create", "update", "delete"],
		reports: ["read", "create", "update", "delete"],
		game_config: ["read", "update", "manage"],
		analytics: ["read", "manage"],
		roles: ["read", "update", "promote", "demote"],
	},
};

// ---------------------------------------------------------------------------
// Permission Checks
// ---------------------------------------------------------------------------

export const hasPermission = (
	role: Role | string,
	resource: Resource,
	action: Action,
): boolean => {
	const validRole = ROLES.includes(role as Role) ? (role as Role) : "player";
	const allowed = PERMISSIONS[validRole]?.[resource];
	return allowed?.includes(action) ?? false;
};

export const hasAnyPermission = (
	role: Role | string,
	resource: Resource,
	actions: Action[],
): boolean => {
	return actions.some((action) => hasPermission(role, resource, action));
};

export const hasAllPermissions = (
	role: Role | string,
	resource: Resource,
	actions: Action[],
): boolean => {
	return actions.every((action) => hasPermission(role, resource, action));
};

// ---------------------------------------------------------------------------
// Resource Ownership
// ---------------------------------------------------------------------------

export const isOwnResource = (
	resource: Resource,
): resource is "own_profile" | "own_inventory" | "own_settings" => {
	return resource.startsWith("own_");
};

export const canAccessResource = (
	role: Role | string,
	resource: Resource,
	action: Action,
	isOwner: boolean,
): boolean => {
	// If it's an "own_" resource, the user must be the owner
	if (isOwnResource(resource) && !isOwner) {
		return false;
	}
	return hasPermission(role, resource, action);
};
