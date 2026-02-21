import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { listContacts } from "../services/contacts.js";
import { listDeals } from "../services/deals.js";
import { listInteractions } from "../services/interactions.js";
import { listOrganizations } from "../services/organizations.js";
import type { EntityType } from "./import-handlers.js";

// biome-ignore lint/suspicious/noExplicitAny: rows come from various service functions with different shapes
type AnyRow = any;

export interface ExportHandler {
	fetchRows(db: PipelineDB): AnyRow[];
	toCsvRow(row: AnyRow): Record<string, unknown>;
	entityType: EntityType;
}

// ── Contacts ────────────────────────────────────────────────────

const contactsExport: ExportHandler = {
	entityType: "contacts",
	fetchRows(db) {
		return listContacts(db);
	},
	toCsvRow(row) {
		return {
			id: row.id,
			name: row.name,
			email: row.email || "",
			phone: row.phone || "",
			organization: row.org_name || "",
			role: row.role || "",
			warmth: row.warmth || "",
			source: row.source || "",
			tags: (row.tags as string[]).join(", "),
			created_at: row.created_at,
		};
	},
};

// ── Organizations ───────────────────────────────────────────────

const organizationsExport: ExportHandler = {
	entityType: "organizations",
	fetchRows(db) {
		return listOrganizations(db).map((r) => ({
			...r,
			tags: (r.tags as string[]) || [],
		}));
	},
	toCsvRow(row) {
		return {
			id: row.id,
			name: row.name,
			domain: row.domain || "",
			industry: row.industry || "",
			size: row.size || "",
			location: row.location || "",
			tags: (row.tags as string[]).join(", "),
			created_at: row.created_at,
		};
	},
};

// ── Deals ───────────────────────────────────────────────────────

const dealsExport: ExportHandler = {
	entityType: "deals",
	fetchRows(db) {
		return listDeals(db);
	},
	toCsvRow(row) {
		return {
			id: row.id,
			title: row.title,
			contact: row.contact_name || "",
			organization: row.org_name || "",
			value: row.value ?? "",
			stage: row.stage || "",
			priority: row.priority || "",
			expected_close: row.expected_close || "",
			created_at: row.created_at,
		};
	},
};

// ── Interactions ────────────────────────────────────────────────

const interactionsExport: ExportHandler = {
	entityType: "interactions",
	fetchRows(db) {
		return listInteractions(db);
	},
	toCsvRow(row) {
		return {
			id: row.id,
			type: row.type || "",
			direction: row.direction || "",
			subject: row.subject || "",
			body: row.body || "",
			contact: row.contact_name || "",
			deal: row.deal_title || "",
			occurred_at: row.occurred_at,
		};
	},
};

// ── Tasks ───────────────────────────────────────────────────────

const tasksExport: ExportHandler = {
	entityType: "tasks",
	fetchRows(db) {
		return db
			.select({
				id: schema.tasks.id,
				title: schema.tasks.title,
				due: schema.tasks.due,
				completed: schema.tasks.completed,
				completed_at: schema.tasks.completed_at,
				contact_name: schema.people.name,
				deal_title: schema.deals.title,
				created_at: schema.tasks.created_at,
			})
			.from(schema.tasks)
			.leftJoin(
				schema.contacts,
				eq(schema.tasks.contact_id, schema.contacts.id),
			)
			.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
			.leftJoin(schema.deals, eq(schema.tasks.deal_id, schema.deals.id))
			.all();
	},
	toCsvRow(row) {
		return {
			id: row.id,
			title: row.title,
			contact: row.contact_name || "",
			deal: row.deal_title || "",
			due: row.due || "",
			completed: row.completed ? "yes" : "no",
			created_at: row.created_at,
		};
	},
};

// ── Registry ────────────────────────────────────────────────────

const handlers: Record<EntityType, ExportHandler> = {
	contacts: contactsExport,
	organizations: organizationsExport,
	deals: dealsExport,
	interactions: interactionsExport,
	tasks: tasksExport,
};

export function getExportHandler(type: EntityType): ExportHandler {
	return handlers[type];
}
