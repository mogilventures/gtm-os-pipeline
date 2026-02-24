import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── People ──────────────────────────────────────────────────────
export const people = sqliteTable("people", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	email: text("email").unique(),
	phone: text("phone"),
	linkedin: text("linkedin"),
	twitter: text("twitter"),
	location: text("location"),
	notes: text("notes"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updated_at: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Organizations ───────────────────────────────────────────────
export const organizations = sqliteTable("organizations", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	domain: text("domain"),
	industry: text("industry"),
	size: text("size"),
	location: text("location"),
	notes: text("notes"),
	tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updated_at: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Contacts (junction: person + org + CRM metadata) ────────────
export const contacts = sqliteTable("contacts", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	person_id: integer("person_id")
		.notNull()
		.references(() => people.id),
	org_id: integer("org_id").references(() => organizations.id),
	role: text("role"),
	warmth: text("warmth").default("cold"),
	source: text("source"),
	tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updated_at: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Deals ───────────────────────────────────────────────────────
export const deals = sqliteTable("deals", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	contact_id: integer("contact_id").references(() => contacts.id),
	org_id: integer("org_id").references(() => organizations.id),
	value: integer("value"),
	currency: text("currency").default("USD"),
	stage: text("stage").notNull().default("lead"),
	priority: text("priority").default("medium"),
	expected_close: text("expected_close"),
	closed_at: text("closed_at"),
	won: integer("won", { mode: "boolean" }),
	close_reason: text("close_reason"),
	notes: text("notes"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updated_at: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Interactions ────────────────────────────────────────────────
export const interactions = sqliteTable("interactions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	contact_id: integer("contact_id").references(() => contacts.id),
	deal_id: integer("deal_id").references(() => deals.id),
	type: text("type").notNull(), // email, call, meeting, note
	direction: text("direction"), // inbound, outbound
	subject: text("subject"),
	body: text("body"),
	message_id: text("message_id"),
	from_address: text("from_address"),
	occurred_at: text("occurred_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Tasks ───────────────────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	contact_id: integer("contact_id").references(() => contacts.id),
	deal_id: integer("deal_id").references(() => deals.id),
	due: text("due"),
	completed: integer("completed", { mode: "boolean" }).default(false),
	completed_at: text("completed_at"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updated_at: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Pending Actions (agent proposals) ───────────────────────────
export const pendingActions = sqliteTable("pending_actions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	action_type: text("action_type").notNull(), // send_email, update_stage, create_task, log_note, create_edge, complete_task, update_warmth, update_priority
	payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
	reasoning: text("reasoning"),
	status: text("status").notNull().default("pending"), // pending, approved, rejected
	resolved_at: text("resolved_at"),
	agent_name: text("agent_name"),
	run_id: text("run_id"),
	memory_id: integer("memory_id"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Custom Fields ──────────────────────────────────────────────
export const customFields = sqliteTable(
	"custom_fields",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		entity_type: text("entity_type").notNull(),
		entity_id: integer("entity_id").notNull(),
		field_name: text("field_name").notNull(),
		field_value: text("field_value"),
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updated_at: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_custom_fields_entity").on(table.entity_type, table.entity_id),
		index("idx_custom_fields_name").on(table.field_name),
	],
);

// ── Schedules ──────────────────────────────────────────────────
export const schedules = sqliteTable("schedules", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	agent_name: text("agent_name").notNull().unique(),
	interval: text("interval").notNull(), // hourly, daily, weekdays, weekly
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	last_run_at: text("last_run_at"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Schedule Logs ──────────────────────────────────────────────
export const scheduleLogs = sqliteTable("schedule_logs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	schedule_id: integer("schedule_id")
		.notNull()
		.references(() => schedules.id),
	agent_name: text("agent_name").notNull(),
	started_at: text("started_at").notNull(),
	finished_at: text("finished_at"),
	status: text("status").notNull().default("running"), // running, completed, failed
	output: text("output"),
	actions_proposed: integer("actions_proposed").default(0),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Edges (relationship graph) ──────────────────────────────────
export const edges = sqliteTable(
	"edges",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		from_type: text("from_type").notNull(), // person, organization, deal
		from_id: integer("from_id").notNull(),
		to_type: text("to_type").notNull(),
		to_id: integer("to_id").notNull(),
		relation: text("relation").notNull(), // works_at, introduced_by, referred_by, co_founder_of, etc.
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_edges_from").on(table.from_type, table.from_id),
		index("idx_edges_to").on(table.to_type, table.to_id),
		index("idx_edges_relation").on(table.relation),
	],
);

// ── Agent Memory ────────────────────────────────────────────────
export const agentMemory = sqliteTable(
	"agent_memory",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		agent_name: text("agent_name").notNull(),
		run_id: text("run_id").notNull(),
		contact_id: integer("contact_id"),
		deal_id: integer("deal_id"),
		action_type: text("action_type").notNull(),
		payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
		reasoning: text("reasoning"),
		outcome: text("outcome").notNull().default("pending"), // pending, approved, rejected
		human_feedback: text("human_feedback"),
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_agent_memory_agent").on(table.agent_name),
		index("idx_agent_memory_contact").on(table.contact_id),
		index("idx_agent_memory_deal").on(table.deal_id),
		index("idx_agent_memory_run").on(table.run_id),
	],
);

// ── Events ──────────────────────────────────────────────────────
export const events = sqliteTable(
	"events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		event_type: text("event_type").notNull(),
		entity_type: text("entity_type").notNull(),
		entity_id: integer("entity_id").notNull(),
		payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
		processed: integer("processed", { mode: "boolean" })
			.notNull()
			.default(false),
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_events_type").on(table.event_type),
		index("idx_events_processed").on(table.processed),
	],
);

// ── Audit Log ──────────────────────────────────────────────────
export const auditLog = sqliteTable(
	"audit_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		actor: text("actor").notNull(),
		command: text("command").notNull(),
		args: text("args"),
		result: text("result"),
		error: text("error"),
		duration_ms: integer("duration_ms"),
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [
		index("idx_audit_log_actor").on(table.actor),
		index("idx_audit_log_created_at").on(table.created_at),
	],
);

// ── Connected Accounts (Composio integrations) ─────────────────
export const connectedAccounts = sqliteTable(
	"connected_accounts",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		toolkit: text("toolkit").notNull(),
		composio_account_id: text("composio_account_id").notNull().unique(),
		label: text("label"),
		user_id: text("user_id"),
		status: text("status").notNull().default("active"),
		created_at: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updated_at: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => [index("idx_connected_accounts_toolkit").on(table.toolkit)],
);

// ── Composio Triggers ──────────────────────────────────────────
export const composioTriggers = sqliteTable("composio_triggers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	trigger_id: text("trigger_id").notNull().unique(),
	toolkit: text("toolkit").notNull(),
	trigger_slug: text("trigger_slug").notNull(),
	connected_account_id: integer("connected_account_id").references(
		() => connectedAccounts.id,
	),
	config: text("config", { mode: "json" }).$type<Record<string, unknown>>(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	last_polled_at: text("last_polled_at"),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// ── Event Hooks ─────────────────────────────────────────────────
export const eventHooks = sqliteTable("event_hooks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	event_type: text("event_type").notNull(),
	agent_name: text("agent_name").notNull(),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	created_at: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});
