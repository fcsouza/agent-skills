import { Elysia } from "elysia";
import type { Role } from "../templates/role-definitions";
import { auth, type Session, type User } from "./auth-setup";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContext {
	user: User;
	session: Session;
}

// ---------------------------------------------------------------------------
// requireAuth — Reject unauthenticated requests
// ---------------------------------------------------------------------------

export const requireAuth = new Elysia({ name: "auth/require" }).derive(
	async ({ request }): Promise<AuthContext> => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			throw new Response(
				JSON.stringify({
					error: "Unauthorized",
					message: "Authentication required.",
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}

		return {
			user: session.user,
			session: session.session,
		};
	},
);

// ---------------------------------------------------------------------------
// requireRole — Check player/mod/admin role
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<Role, number> = {
	player: 0,
	moderator: 1,
	admin: 2,
};

export const requireRole = (minimumRole: Role) =>
	new Elysia({ name: `auth/role/${minimumRole}` })
		.use(requireAuth)
		.onBeforeHandle(({ user }) => {
			const userRole = (user.role as Role) ?? "player";
			const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
			const requiredLevel = ROLE_HIERARCHY[minimumRole];

			if (userLevel < requiredLevel) {
				throw new Response(
					JSON.stringify({
						error: "Forbidden",
						message: `Requires ${minimumRole} role or higher.`,
						currentRole: userRole,
					}),
					{ status: 403, headers: { "Content-Type": "application/json" } },
				);
			}
		});

// ---------------------------------------------------------------------------
// optionalAuth — Attach user if present, continue if not
// ---------------------------------------------------------------------------

export const optionalAuth = new Elysia({ name: "auth/optional" }).derive(
	async ({ request }): Promise<Partial<AuthContext>> => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session) {
			return {
				user: undefined,
				session: undefined,
			};
		}

		return {
			user: session.user,
			session: session.session,
		};
	},
);

// ---------------------------------------------------------------------------
// BetterAuth Handler — Mount as Elysia route to handle all /api/auth/* routes
// ---------------------------------------------------------------------------

export const authHandler = new Elysia({ name: "auth/handler" }).all(
	"/api/auth/*",
	async ({ request }) => {
		return auth.handler(request);
	},
);
