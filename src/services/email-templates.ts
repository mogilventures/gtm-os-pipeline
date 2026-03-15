import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { showContact } from "./contacts.js";
import { emitEvent } from "./events.js";

export function extractVariables(text: string): string[] {
	const matches = text.matchAll(/\{\{(\w+)\}\}/g);
	const vars = new Set<string>();
	for (const m of matches) {
		vars.add(m[1]);
	}
	return [...vars].sort();
}

interface AddTemplateInput {
	name: string;
	subject: string;
	body: string;
	category?: string;
}

export function addTemplate(db: PipelineDB, input: AddTemplateInput) {
	const variables = extractVariables(`${input.subject} ${input.body}`);
	try {
		const row = db
			.insert(schema.emailTemplates)
			.values({
				name: input.name,
				subject: input.subject,
				body: input.body,
				variables,
				category: input.category,
			})
			.returning()
			.get();

		emitEvent(db, "template_created", "email_template", row.id, {
			name: row.name,
		});

		return row;
	} catch (err: unknown) {
		if (
			err instanceof Error &&
			err.message.includes("UNIQUE constraint failed")
		) {
			throw new Error(`Template "${input.name}" already exists`);
		}
		throw err;
	}
}

export function listTemplates(db: PipelineDB, filters?: { category?: string }) {
	const rows = db.select().from(schema.emailTemplates).all();
	if (filters?.category) {
		return rows.filter((r) => r.category === filters.category);
	}
	return rows;
}

export function getTemplate(db: PipelineDB, id: number) {
	return db
		.select()
		.from(schema.emailTemplates)
		.where(eq(schema.emailTemplates.id, id))
		.get();
}

interface EditTemplateInput {
	name?: string;
	subject?: string;
	body?: string;
	category?: string;
}

export function editTemplate(
	db: PipelineDB,
	id: number,
	updates: EditTemplateInput,
) {
	const existing = getTemplate(db, id);
	if (!existing) throw new Error("Template not found");

	const newSubject = updates.subject ?? existing.subject;
	const newBody = updates.body ?? existing.body;
	const variables =
		updates.subject !== undefined || updates.body !== undefined
			? extractVariables(`${newSubject} ${newBody}`)
			: (existing.variables as string[]);

	const values: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
		variables,
	};
	if (updates.name !== undefined) values.name = updates.name;
	if (updates.subject !== undefined) values.subject = updates.subject;
	if (updates.body !== undefined) values.body = updates.body;
	if (updates.category !== undefined) values.category = updates.category;

	db.update(schema.emailTemplates)
		.set(values)
		.where(eq(schema.emailTemplates.id, id))
		.run();
}

export function removeTemplate(db: PipelineDB, id: number) {
	db.delete(schema.emailTemplates)
		.where(eq(schema.emailTemplates.id, id))
		.run();
}

export function getTemplatesForFuzzy(db: PipelineDB) {
	return db
		.select({
			id: schema.emailTemplates.id,
			name: schema.emailTemplates.name,
		})
		.from(schema.emailTemplates)
		.all();
}

export function renderTemplate(
	template: { subject: string; body: string },
	variables: Record<string, string>,
): { subject: string; body: string } {
	let subject = template.subject;
	let body = template.body;
	for (const [key, value] of Object.entries(variables)) {
		const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
		subject = subject.replace(pattern, value);
		body = body.replace(pattern, value);
	}
	return { subject, body };
}

export function buildContactVariables(
	db: PipelineDB,
	contactId: number,
): Record<string, string> {
	const contact = showContact(db, contactId);
	if (!contact) return {};

	const vars: Record<string, string> = {};

	if (contact.name) {
		vars.name = contact.name;
		const parts = contact.name.split(/\s+/);
		vars.first_name = parts[0];
		if (parts.length > 1) {
			vars.last_name = parts.slice(1).join(" ");
		}
	}
	if (contact.email) vars.email = contact.email;
	if (contact.phone) vars.phone = contact.phone;
	if (contact.role) vars.role = contact.role;
	if (contact.org_name) vars.company = contact.org_name;

	// Look up org domain if we have an org
	if (contact.org_id) {
		const org = db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.id, contact.org_id))
			.get();
		if (org?.domain) vars.company_domain = org.domain;
	}

	return vars;
}
