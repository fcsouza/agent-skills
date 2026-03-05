import {
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

// ─── Analytics Events ───────────────────────────────────────────────────────

export const analyticsEvents = pgTable(
	"analytics_events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id").notNull(),
		sessionId: text("session_id").notNull(),
		eventName: text("event_name").notNull(),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({}),
		platform: text("platform").notNull(),
		version: text("version").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("analytics_events_user_event_idx").on(table.userId, table.eventName),
		index("analytics_events_event_created_idx").on(
			table.eventName,
			table.createdAt,
		),
		index("analytics_events_user_id_idx").on(table.userId),
		index("analytics_events_session_id_idx").on(table.sessionId),
		index("analytics_events_created_at_idx").on(table.createdAt),
	],
);

// ─── Analytics Sessions ─────────────────────────────────────────────────────

export const analyticsSessions = pgTable(
	"analytics_sessions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id").notNull(),
		startedAt: timestamp("started_at").notNull().defaultNow(),
		lastHeartbeatAt: timestamp("last_heartbeat_at").notNull().defaultNow(),
		endedAt: timestamp("ended_at"),
		platform: text("platform").notNull(),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({}),
	},
	(table) => [
		index("analytics_sessions_user_id_idx").on(table.userId),
		index("analytics_sessions_started_at_idx").on(table.startedAt),
		index("analytics_sessions_user_started_idx").on(
			table.userId,
			table.startedAt,
		),
	],
);

// ─── Analytics Retention Cohorts ────────────────────────────────────────────

export const analyticsRetentionCohorts = pgTable(
	"analytics_retention_cohorts",
	{
		cohortDate: date("cohort_date").notNull(),
		day: integer("day").notNull(),
		totalUsers: integer("total_users").notNull().default(0),
		retainedUsers: integer("retained_users").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.cohortDate, table.day] }),
		index("analytics_retention_cohort_date_idx").on(table.cohortDate),
		index("analytics_retention_day_idx").on(table.cohortDate, table.day),
	],
);

// ─── Type Exports ───────────────────────────────────────────────────────────

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;

export type AnalyticsRetentionCohort =
	typeof analyticsRetentionCohorts.$inferSelect;
export type NewAnalyticsRetentionCohort =
	typeof analyticsRetentionCohorts.$inferInsert;
