import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { addContact } from "../services/contacts.js";
import { addDeal } from "../services/deals.js";
import { logInteraction } from "../services/interactions.js";
import { addOrganization } from "../services/organizations.js";
import { addTask, completeTask } from "../services/tasks.js";
import { CF_PREFIX } from "./custom-fields-io.js";
import { isValidEmail, parseBool, parseDate } from "./validation.js";

// ── Shared helpers ──────────────────────────────────────────────

export function normalizeColumn(
	col: string,
	columnMap: Record<string, string>,
): string {
	const lower = col.toLowerCase().trim();
	// cf: columns pass through as-is (lowercased)
	if (lower.startsWith(CF_PREFIX)) return lower;
	return columnMap[lower] || lower;
}

export function getMappedValue(
	row: Record<string, string>,
	mapping: Record<string, string>,
	targetField: string,
): string | null {
	for (const [rawCol, mappedCol] of Object.entries(mapping)) {
		if (mappedCol === targetField && row[rawCol]) {
			return row[rawCol];
		}
	}
	return null;
}

// ── FK resolvers ────────────────────────────────────────────────

export function resolveContactByName(
	db: PipelineDB,
	name: string,
): number | null {
	const row = db
		.select({ id: schema.contacts.id })
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.all()
		.find((r) => {
			const person = db
				.select({ name: schema.people.name })
				.from(schema.people)
				.innerJoin(
					schema.contacts,
					eq(schema.contacts.person_id, schema.people.id),
				)
				.where(eq(schema.contacts.id, r.id))
				.get();
			return person?.name.toLowerCase() === name.toLowerCase();
		});
	return row?.id ?? null;
}

export function resolveOrgByName(db: PipelineDB, name: string): number | null {
	const row = db
		.select()
		.from(schema.organizations)
		.all()
		.find((r) => r.name.toLowerCase() === name.toLowerCase());
	return row?.id ?? null;
}

export function resolveDealByTitle(
	db: PipelineDB,
	title: string,
): number | null {
	const row = db
		.select()
		.from(schema.deals)
		.all()
		.find((r) => r.title.toLowerCase() === title.toLowerCase());
	return row?.id ?? null;
}

function parseValue(raw: string): number | undefined {
	const cleaned = raw.replace(/[$,]/g, "").trim();
	const num = Number.parseInt(cleaned, 10);
	return Number.isNaN(num) ? undefined : num;
}

// ── Import handler interface ────────────────────────────────────

export interface ImportHandler {
	columnMap: Record<string, string>;
	previewRow(
		row: Record<string, string>,
		mapping: Record<string, string>,
	): string;
	importRow(
		db: PipelineDB,
		row: Record<string, string>,
		mapping: Record<string, string>,
	): number;
}

// ── Contacts handler ────────────────────────────────────────────

const contactsHandler: ImportHandler = {
	columnMap: {
		"full name": "name",
		"first name": "first_name",
		"last name": "last_name",
		first: "first_name",
		last: "last_name",
		name: "name",
		email: "email",
		"email address": "email",
		"e-mail": "email",
		phone: "phone",
		"phone number": "phone",
		company: "org",
		organization: "org",
		organisation: "org",
		"company name": "org",
		role: "role",
		title: "role",
		"job title": "role",
		position: "role",
		source: "source",
		tags: "tags",
		tag: "tags",
		linkedin: "linkedin",
		"linkedin url": "linkedin",
		warmth: "warmth",
		id: "id",
		created_at: "created_at",
	},
	previewRow(row, mapping) {
		const name =
			getMappedValue(row, mapping, "name") ||
			`${getMappedValue(row, mapping, "first_name") || ""} ${getMappedValue(row, mapping, "last_name") || ""}`.trim();
		const email = getMappedValue(row, mapping, "email");
		return `${name || "(no name)"} <${email || "no email"}>`;
	},
	importRow(db, row, mapping) {
		const name =
			getMappedValue(row, mapping, "name") ||
			`${getMappedValue(row, mapping, "first_name") || ""} ${getMappedValue(row, mapping, "last_name") || ""}`.trim();
		if (!name) throw new Error("No name");

		let email = getMappedValue(row, mapping, "email") || undefined;
		if (email) {
			if (!isValidEmail(email)) {
				console.warn(
					`Invalid email "${email}" — importing contact without email`,
				);
				email = undefined;
			} else {
				// Duplicate detection
				const existing = db
					.select({ email: schema.people.email })
					.from(schema.people)
					.where(eq(schema.people.email, email))
					.get();
				if (existing) {
					throw new Error(
						`Duplicate: contact with email ${email} already exists`,
					);
				}
			}
		}

		const result = addContact(db, {
			name,
			email,
			phone: getMappedValue(row, mapping, "phone") || undefined,
			linkedin: getMappedValue(row, mapping, "linkedin") || undefined,
			org: getMappedValue(row, mapping, "org") || undefined,
			role: getMappedValue(row, mapping, "role") || undefined,
			source: getMappedValue(row, mapping, "source") || undefined,
			warmth: getMappedValue(row, mapping, "warmth") || undefined,
			tags: getMappedValue(row, mapping, "tags")
				?.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
		});
		return result.id;
	},
};

// ── Organizations handler ───────────────────────────────────────

const organizationsHandler: ImportHandler = {
	columnMap: {
		name: "name",
		"company name": "name",
		"org name": "name",
		organization: "name",
		organisation: "name",
		company: "name",
		domain: "domain",
		website: "domain",
		url: "domain",
		industry: "industry",
		sector: "industry",
		size: "size",
		"company size": "size",
		employees: "size",
		location: "location",
		city: "location",
		address: "location",
		tags: "tags",
		tag: "tags",
		id: "id",
		created_at: "created_at",
	},
	previewRow(row, mapping) {
		const name = getMappedValue(row, mapping, "name");
		const domain = getMappedValue(row, mapping, "domain");
		return `${name || "(no name)"}${domain ? ` (${domain})` : ""}`;
	},
	importRow(db, row, mapping) {
		const name = getMappedValue(row, mapping, "name");
		if (!name) throw new Error("No name");

		const result = addOrganization(db, {
			name,
			domain: getMappedValue(row, mapping, "domain") || undefined,
			industry: getMappedValue(row, mapping, "industry") || undefined,
			size: getMappedValue(row, mapping, "size") || undefined,
			location: getMappedValue(row, mapping, "location") || undefined,
			tags: getMappedValue(row, mapping, "tags")
				?.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
		});
		return result.id;
	},
};

// ── Deals handler ───────────────────────────────────────────────

const dealsHandler: ImportHandler = {
	columnMap: {
		title: "title",
		"deal title": "title",
		"deal name": "title",
		name: "title",
		contact: "contact",
		"contact name": "contact",
		org: "org",
		organization: "org",
		organisation: "org",
		company: "org",
		value: "value",
		amount: "value",
		"deal value": "value",
		"deal amount": "value",
		stage: "stage",
		priority: "priority",
		"expected close": "expected_close",
		expected_close: "expected_close",
		"close date": "expected_close",
		id: "id",
		created_at: "created_at",
	},
	previewRow(row, mapping) {
		const title = getMappedValue(row, mapping, "title");
		const value = getMappedValue(row, mapping, "value");
		return `${title || "(no title)"}${value ? ` ($${value})` : ""}`;
	},
	importRow(db, row, mapping) {
		const title = getMappedValue(row, mapping, "title");
		if (!title) throw new Error("No title");

		const contactName = getMappedValue(row, mapping, "contact");
		const orgName = getMappedValue(row, mapping, "org");
		const rawValue = getMappedValue(row, mapping, "value");

		const contactId = contactName
			? (resolveContactByName(db, contactName) ?? undefined)
			: undefined;
		const orgId = orgName
			? (resolveOrgByName(db, orgName) ?? undefined)
			: undefined;

		let expectedClose =
			getMappedValue(row, mapping, "expected_close") || undefined;
		if (expectedClose) {
			const parsed = parseDate(expectedClose);
			if (!parsed) {
				console.warn(
					`Invalid date "${expectedClose}" — importing deal without expected_close`,
				);
				expectedClose = undefined;
			} else {
				expectedClose = parsed;
			}
		}

		const result = addDeal(db, {
			title,
			contactId,
			orgId,
			value: rawValue ? parseValue(rawValue) : undefined,
			stage: getMappedValue(row, mapping, "stage") || undefined,
			priority: getMappedValue(row, mapping, "priority") || undefined,
			expectedClose,
		});
		return result.id;
	},
};

// ── Interactions handler ────────────────────────────────────────

const interactionsHandler: ImportHandler = {
	columnMap: {
		contact: "contact",
		"contact name": "contact",
		type: "type",
		kind: "type",
		direction: "direction",
		subject: "subject",
		body: "body",
		notes: "body",
		content: "body",
		deal: "deal",
		"deal title": "deal",
		occurred_at: "occurred_at",
		"occurred at": "occurred_at",
		id: "id",
		created_at: "created_at",
	},
	previewRow(row, mapping) {
		const contact = getMappedValue(row, mapping, "contact");
		const type = getMappedValue(row, mapping, "type");
		const subject = getMappedValue(row, mapping, "subject");
		return `${type || "?"} with ${contact || "(no contact)"}${subject ? `: ${subject}` : ""}`;
	},
	importRow(db, row, mapping) {
		const contactName = getMappedValue(row, mapping, "contact");
		const type = getMappedValue(row, mapping, "type");
		if (!contactName) throw new Error("No contact");
		if (!type) throw new Error("No type");

		const contactId = resolveContactByName(db, contactName);
		if (contactId === null)
			throw new Error(`Contact not found: ${contactName}`);

		const dealTitle = getMappedValue(row, mapping, "deal");
		const dealId = dealTitle
			? (resolveDealByTitle(db, dealTitle) ?? undefined)
			: undefined;

		let occurredAt = getMappedValue(row, mapping, "occurred_at") || undefined;
		if (occurredAt) {
			// Accept full ISO timestamps as-is, otherwise try parseDate
			if (!occurredAt.includes("T")) {
				const parsed = parseDate(occurredAt);
				if (!parsed) {
					console.warn(
						`Invalid date "${occurredAt}" — importing interaction without occurred_at`,
					);
					occurredAt = undefined;
				} else {
					occurredAt = parsed;
				}
			}
		}

		const result = logInteraction(db, {
			contactId,
			type,
			direction: getMappedValue(row, mapping, "direction") || undefined,
			subject: getMappedValue(row, mapping, "subject") || undefined,
			body: getMappedValue(row, mapping, "body") || undefined,
			dealId,
			occurredAt,
		});
		return result.id;
	},
};

// ── Tasks handler ───────────────────────────────────────────────

const tasksHandler: ImportHandler = {
	columnMap: {
		title: "title",
		task: "title",
		"task title": "title",
		name: "title",
		contact: "contact",
		"contact name": "contact",
		deal: "deal",
		"deal title": "deal",
		due: "due",
		"due date": "due",
		deadline: "due",
		completed: "completed",
		id: "id",
		created_at: "created_at",
	},
	previewRow(row, mapping) {
		const title = getMappedValue(row, mapping, "title");
		const due = getMappedValue(row, mapping, "due");
		return `${title || "(no title)"}${due ? ` (due: ${due})` : ""}`;
	},
	importRow(db, row, mapping) {
		const title = getMappedValue(row, mapping, "title");
		if (!title) throw new Error("No title");

		const contactName = getMappedValue(row, mapping, "contact");
		const dealTitle = getMappedValue(row, mapping, "deal");

		const contactId = contactName
			? (resolveContactByName(db, contactName) ?? undefined)
			: undefined;
		const dealId = dealTitle
			? (resolveDealByTitle(db, dealTitle) ?? undefined)
			: undefined;

		let due = getMappedValue(row, mapping, "due") || undefined;
		if (due) {
			const parsed = parseDate(due);
			if (!parsed) {
				console.warn(`Invalid date "${due}" — importing task without due date`);
				due = undefined;
			} else {
				due = parsed;
			}
		}

		const result = addTask(db, {
			title,
			contactId,
			dealId,
			due,
		});

		const completedRaw = getMappedValue(row, mapping, "completed");
		if (completedRaw && parseBool(completedRaw)) {
			completeTask(db, result.id);
		}

		return result.id;
	},
};

// ── Handler registry ────────────────────────────────────────────

export type EntityType =
	| "contacts"
	| "organizations"
	| "deals"
	| "interactions"
	| "tasks";

const handlers: Record<EntityType, ImportHandler> = {
	contacts: contactsHandler,
	organizations: organizationsHandler,
	deals: dealsHandler,
	interactions: interactionsHandler,
	tasks: tasksHandler,
};

export function getImportHandler(type: EntityType): ImportHandler {
	return handlers[type];
}
