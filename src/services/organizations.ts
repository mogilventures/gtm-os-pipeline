import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

interface AddOrgInput {
	name: string;
	domain?: string;
	industry?: string;
	size?: string;
	location?: string;
	tags?: string[];
}

export function addOrganization(db: PipelineDB, input: AddOrgInput) {
	return db
		.insert(schema.organizations)
		.values({
			name: input.name,
			domain: input.domain,
			industry: input.industry,
			size: input.size,
			location: input.location,
			tags: input.tags || [],
		})
		.returning()
		.get();
}

export function listOrganizations(
	db: PipelineDB,
	filters?: { industry?: string; tag?: string },
) {
	let rows = db.select().from(schema.organizations).all();

	if (filters?.industry) {
		rows = rows.filter(
			(r) => r.industry?.toLowerCase() === filters.industry!.toLowerCase(),
		);
	}
	if (filters?.tag) {
		rows = rows.filter((r) =>
			((r.tags as string[]) || []).includes(filters.tag!),
		);
	}

	return rows;
}

export function showOrganization(db: PipelineDB, orgId: number) {
	const org = db
		.select()
		.from(schema.organizations)
		.where(eq(schema.organizations.id, orgId))
		.get();
	if (!org) return null;

	const orgContacts = db
		.select({
			id: schema.contacts.id,
			name: schema.people.name,
			email: schema.people.email,
			role: schema.contacts.role,
		})
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.where(eq(schema.contacts.org_id, orgId))
		.all();

	const orgDeals = db
		.select()
		.from(schema.deals)
		.where(eq(schema.deals.org_id, orgId))
		.all();

	return {
		...org,
		tags: (org.tags as string[]) || [],
		contacts: orgContacts,
		deals: orgDeals,
	};
}

export function editOrganization(
	db: PipelineDB,
	orgId: number,
	updates: Partial<AddOrgInput>,
) {
	const setValues: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
	};
	if (updates.domain !== undefined) setValues.domain = updates.domain;
	if (updates.industry !== undefined) setValues.industry = updates.industry;
	if (updates.size !== undefined) setValues.size = updates.size;
	if (updates.location !== undefined) setValues.location = updates.location;

	db.update(schema.organizations)
		.set(setValues)
		.where(eq(schema.organizations.id, orgId))
		.run();
}

export function getOrgsForFuzzy(db: PipelineDB) {
	return db
		.select({ id: schema.organizations.id, name: schema.organizations.name })
		.from(schema.organizations)
		.all();
}

export function getOrgContacts(db: PipelineDB, orgId: number) {
	return db
		.select({
			id: schema.contacts.id,
			name: schema.people.name,
			email: schema.people.email,
			role: schema.contacts.role,
			warmth: schema.contacts.warmth,
		})
		.from(schema.contacts)
		.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.where(eq(schema.contacts.org_id, orgId))
		.all();
}
