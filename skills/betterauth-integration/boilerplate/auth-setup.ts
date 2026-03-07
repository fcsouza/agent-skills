import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "../db"; // Your Drizzle instance

// ---------------------------------------------------------------------------
// BetterAuth Configuration
// ---------------------------------------------------------------------------

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),

	// -----------------------------------------------------------------------
	// Email / Password
	// -----------------------------------------------------------------------
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
	},

	// -----------------------------------------------------------------------
	// OAuth Providers (common for gamers)
	// -----------------------------------------------------------------------
	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		github: {
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
		},
		twitch: {
			clientId: process.env.TWITCH_CLIENT_ID!,
			clientSecret: process.env.TWITCH_CLIENT_SECRET!,
		},
	},

	// -----------------------------------------------------------------------
	// Session Configuration (cookie-based for web games)
	// -----------------------------------------------------------------------
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Refresh session every 24 hours
		cookieCache: {
			enabled: true,
			maxAge: 60 * 5, // 5 minute cache to reduce DB lookups
		},
	},

	// -----------------------------------------------------------------------
	// Custom User Fields
	// -----------------------------------------------------------------------
	user: {
		additionalFields: {
			displayName: {
				type: "string",
				required: false,
				defaultValue: "",
				input: true,
			},
			avatarUrl: {
				type: "string",
				required: false,
				defaultValue: "",
				input: true,
			},
			role: {
				type: "string",
				required: false,
				defaultValue: "player",
				input: false, // Cannot be set by the user directly
			},
		},
	},

	// -----------------------------------------------------------------------
	// Plugins
	// -----------------------------------------------------------------------
	plugins: [
		admin(), // Adds admin management endpoints
	],

	// -----------------------------------------------------------------------
	// Rate Limiting (aggressive for auth endpoints)
	// -----------------------------------------------------------------------
	rateLimit: {
		window: 60, // 1 minute window
		max: 10, // 10 requests per window
		customRules: {
			"/sign-in/email": {
				window: 60,
				max: 5, // 5 login attempts per minute
			},
			"/sign-up/email": {
				window: 300,
				max: 3, // 3 signups per 5 minutes
			},
		},
	},

	// -----------------------------------------------------------------------
	// Advanced
	// -----------------------------------------------------------------------
	trustedOrigins: [process.env.APP_URL ?? "http://localhost:3000"],
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
