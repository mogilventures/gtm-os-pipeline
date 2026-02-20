import { and, eq, like, sql } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

export interface AddContactInput {
	name: string;
	email?: string;
	phone?: string;
	linkedin?: string;
	role?: string;
	org?: string;
	tags?: string[];
	source?: string;
	warmth?: string;
}

export interface ContactRow {
	id: number;
	name: string;
	email: string | null;
	phone: string | null;
	role: string | null;
	warmth: string | null;
	source: string | null;
	tags: string[];
	org_name: string | null;
	org_id: number | null;
	person_id: number;
	created_at: string;
	updated_at: string;
}

export function addContact(db: PipelineDB, input: AddContactInput): ContactRow {
	// Find or create person by email
	let person: typeof schema.people.$inferSelect | undefined;
	if (input.email) {
		person = db
			.select()
			.from(schema.people)
			.where(eq(schema.people.email, input.email))
			.get();
	}

	if (!person) {
		person = db
			.insert(schema.people)
			.values({
				name: input.name,
				email: input.email,
				phone: input.phone,
				linkedin: input.linkedin,
			})
			.returning()
			.get();
	}

	// Find or create organization
	let orgId: number | undefined;
	let orgName: string | null = null;
	if (input.org) {
		let org = db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.name, input.org))
			.get();
		if (!org) {
			org = db
				.insert(schema.organizations)
				.values({ name: input.org })
				.returning()
				.get();
		}
		orgId = org.id;
		orgName = org.name;
	}

	const contact = db
		.insert(schema.contacts)
		.values({
			person_id: person.id,
			org_id: orgId,
			role: input.role,
			warmth: input.warmth || "cold",
			source: input.source,
			tags: input.tags || [],
		})
		.returning()
		.get();

	return {
		id: contact.id,
		name: person.name,
		email: person.email,
		phone: person.phone,
		role: contact.role,
		warmth: contact.warmth,
		source: contact.source,
		tags: (contact.tags as string[]) || [],
		org_name: orgName,
		org_id: contact.org_id ?? null,
		person_id: person.id,
		created_at: contact.created_at,
		updated_at: contact.updated_at,
	};
}

export function listContacts(
	db: PipelineDB,
	filters?: { tag?: string; org?: string; warmth?: string; staleDays?: number },
): ContactRow[] {
	const rows = db
		.select({
			id: schema.contacts.id,
			name: schema.people.name,
			email: schema.people.email,
			phone: schema.people.phone,
			role: schema.contacts.role,
			warmth: schema.contacts.warmth,
			source: schema.contacts.source,
			tags: schema.contacts.tags,
			org_name: schema.organizations.name,
			org_id: schema.contacts.org_id,
			person_id: schema.contacts.person_id,
			created_at: schema.contacts.created_at,
			updated_at: schema.contacts.updated_at,
		})
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(
			schema.organizations,
			eq(schema.contacts.org_id, schema.organizations.id),
		)
		.all()
		.map((r) => ({
			...r,
			tags: (r.tags as string[]) || [],
		}));

	let result = rows;

	if (filters?.tag) {
		result = result.filter((r) => r.tags.includes(filters.tag!));
	}
	if (filters?.org) {
		result = result.filter(
			(r) => r.org_name?.toLowerCase() === filters.org!.toLowerCase(),
		);
	}
	if (filters?.warmth) {
		result = result.filter((r) => r.warmth === filters.warmth);
	}
	if (filters?.staleDays) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - filters.staleDays);
		const cutoffStr = cutoff.toISOString();
		result = result.filter((r) => r.updated_at < cutoffStr);
	}

	return result;
}

export function showContact(db: PipelineDB, contactId: number) {
	const contact = db
		.select({
			id: schema.contacts.id,
			name: schema.people.name,
			email: schema.people.email,
			phone: schema.people.phone,
			linkedin: schema.people.linkedin,
			role: schema.contacts.role,
			warmth: schema.contacts.warmth,
			source: schema.contacts.source,
			tags: schema.contacts.tags,
			org_name: schema.organizations.name,
			org_id: schema.contacts.org_id,
			person_id: schema.contacts.person_id,
			created_at: schema.contacts.created_at,
			updated_at: schema.contacts.updated_at,
		})
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(
			schema.organizations,
			eq(schema.contacts.org_id, schema.organizations.id),
		)
		.where(eq(schema.contacts.id, contactId))
		.get();

	if (!contact) return null;

	const interactions = db
		.select()
		.from(schema.interactions)
		.where(eq(schema.interactions.contact_id, contactId))
		.all();

	const contactDeals = db
		.select()
		.from(schema.deals)
		.where(eq(schema.deals.contact_id, contactId))
		.all();

	const contactTasks = db
		.select()
		.from(schema.tasks)
		.where(eq(schema.tasks.contact_id, contactId))
		.all();

	return {
		...contact,
		tags: (contact.tags as string[]) || [],
		interactions,
		deals: contactDeals,
		tasks: contactTasks,
	};
}

export function editContact(
	db: PipelineDB,
	contactId: number,
	updates: { role?: string; warmth?: string; org?: string },
): void {
	const now = new Date().toISOString();

	if (updates.role !== undefined || updates.warmth !== undefined) {
		const contactUpdates: Record<string, unknown> = { updated_at: now };
		if (updates.role !== undefined) contactUpdates.role = updates.role;
		if (updates.warmth !== undefined) contactUpdates.warmth = updates.warmth;
		db.update(schema.contacts)
			.set(contactUpdates)
			.where(eq(schema.contacts.id, contactId))
			.run();
	}

	if (updates.org !== undefined) {
		let org = db
			.select()
			.from(schema.organizations)
			.where(eq(schema.organizations.name, updates.org))
			.get();
		if (!org) {
			org = db
				.insert(schema.organizations)
				.values({ name: updates.org })
				.returning()
				.get();
		}
		db.update(schema.contacts)
			.set({ org_id: org.id, updated_at: now })
			.where(eq(schema.contacts.id, contactId))
			.run();
	}
}

export function tagContact(
	db: PipelineDB,
	contactId: number,
	add: string[],
	remove: string[],
): string[] {
	const contact = db
		.select()
		.from(schema.contacts)
		.where(eq(schema.contacts.id, contactId))
		.get();
	if (!contact) throw new Error("Contact not found");

	let tags = (contact.tags as string[]) || [];
	for (const t of add) {
		if (!tags.includes(t)) tags.push(t);
	}
	tags = tags.filter((t) => !remove.includes(t));

	db.update(schema.contacts)
		.set({ tags, updated_at: new Date().toISOString() })
		.where(eq(schema.contacts.id, contactId))
		.run();

	return tags;
}

export function removeContact(db: PipelineDB, contactId: number): void {
	// Delete related records first
	db.delete(schema.interactions)
		.where(eq(schema.interactions.contact_id, contactId))
		.run();
	db.delete(schema.tasks)
		.where(eq(schema.tasks.contact_id, contactId))
		.run();
	db.delete(schema.deals)
		.where(eq(schema.deals.contact_id, contactId))
		.run();
	db.delete(schema.contacts)
		.where(eq(schema.contacts.id, contactId))
		.run();
}

export function addNote(
	db: PipelineDB,
	contactId: number,
	body: string,
): typeof schema.interactions.$inferSelect {
	// Update contact timestamp
	db.update(schema.contacts)
		.set({ updated_at: new Date().toISOString() })
		.where(eq(schema.contacts.id, contactId))
		.run();

	return db
		.insert(schema.interactions)
		.values({
			contact_id: contactId,
			type: "note",
			body,
		})
		.returning()
		.get();
}

export function getContactsForFuzzy(db: PipelineDB) {
	return db
		.select({
			id: schema.contacts.id,
			name: schema.people.name,
			email: schema.people.email,
		})
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.all();
}
