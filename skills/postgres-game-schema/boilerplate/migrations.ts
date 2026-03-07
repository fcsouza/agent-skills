/**
 * Drizzle migration setup for game schemas.
 *
 * 1. Create drizzle.config.ts at your project root (see below).
 * 2. Generate migrations: bunx drizzle-kit generate
 * 3. Run migrations:      bunx drizzle-kit migrate
 * 4. Open Drizzle Studio: bunx drizzle-kit studio
 */

// ─── drizzle.config.ts ──────────────────────────────────────────────────────
//
// import { defineConfig } from 'drizzle-kit';
//
// export default defineConfig({
//   schema: './src/db/schema.ts',
//   out: './drizzle/migrations',
//   dialect: 'postgresql',
//   dbCredentials: {
//     url: process.env.DATABASE_URL!,
//   },
//   verbose: true,
//   strict: true,
// });

// ─── Database client setup (Neon serverless) ────────────────────────────────

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

// ─── Alternative: Neon WebSocket pooling (for long-lived connections) ────────
//
// import { Pool } from '@neondatabase/serverless';
// import { drizzle } from 'drizzle-orm/neon-serverless';
// import * as schema from './schema';
//
// const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
// export const db = drizzle(pool, { schema });

// ─── Migration runner (programmatic) ─────────────────────────────────────────

import { migrate } from "drizzle-orm/neon-http/migrator";

export const runMigrations = async () => {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle/migrations" });
	console.log("Migrations complete.");
};
