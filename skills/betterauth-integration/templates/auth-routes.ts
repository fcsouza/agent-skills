import Elysia from "elysia";
import { requireAuth, requireRole } from "../boilerplate/auth-middleware";
import { auth } from "../boilerplate/auth-setup";

/**
 * Standard auth route patterns for game servers.
 * Mount on your Elysia app: app.use(authRoutes)
 */

export const authRoutes = new Elysia({ prefix: "/auth" })
	// Sign up with email/password
	.post("/signup", async ({ body }) => {
		const { email, password, displayName } = body as {
			email: string;
			password: string;
			displayName: string;
		};
		const result = await auth.api.signUpEmail({
			body: { email, password, name: displayName },
		});
		return result;
	})

	// Login with email/password
	.post("/login", async ({ body }) => {
		const { email, password } = body as { email: string; password: string };
		const result = await auth.api.signInEmail({
			body: { email, password },
		});
		return result;
	})

	// Logout (invalidate session)
	.post("/logout", async ({ headers }) => {
		await auth.api.signOut({
			headers: new Headers(headers as Record<string, string>),
		});
		return { success: true };
	})

	// Get current session / user
	.get("/session", async ({ headers }) => {
		const session = await auth.api.getSession({
			headers: new Headers(headers as Record<string, string>),
		});
		if (!session) return { authenticated: false };
		return {
			authenticated: true,
			user: {
				id: session.user.id,
				email: session.user.email,
				displayName: session.user.name,
				role: (session.user as Record<string, unknown>).role ?? "player",
			},
		};
	})

	// OAuth: initiate provider login
	.get("/oauth/:provider", async ({ params }) => {
		const { provider } = params;
		// BetterAuth handles OAuth redirect internally
		// Client should redirect to: /api/auth/sign-in/{provider}
		return {
			redirectUrl: `/api/auth/sign-in/${provider}`,
			supportedProviders: ["discord", "google", "github", "twitch"],
		};
	});

/**
 * Admin routes — require admin role.
 */
export const adminRoutes = new Elysia({ prefix: "/admin" })
	.use(requireAuth)
	.use(requireRole("admin"))

	// List players (paginated)
	.get("/users", async ({ query }) => {
		const page = Number(query?.page ?? 1);
		const limit = Number(query?.limit ?? 50);
		// Replace with actual DB query
		return { page, limit, users: [], total: 0 };
	})

	// Update player role
	.patch("/users/:id/role", async ({ params, body }) => {
		const { id } = params;
		const { role } = body as { role: "player" | "moderator" | "admin" };
		// Replace with actual DB update
		return { id, role, updated: true };
	})

	// Ban/unban player
	.patch("/users/:id/ban", async ({ params, body }) => {
		const { id } = params;
		const { banned, reason } = body as { banned: boolean; reason?: string };
		// Replace with actual DB update + session invalidation
		return { id, banned, reason, updated: true };
	});
