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
	action_type: text("action_type").notNull(), // send_email, update_stage, create_task, log_note, create_edge
	payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
	reasoning: text("reasoning"),
	status: text("status").notNull().default("pending"), // pending, approved, rejected
	resolved_at: text("resolved_at"),
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
