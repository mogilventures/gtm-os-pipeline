import { and, eq, or } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

type EntityType = "person" | "organization" | "deal";

interface ResolvedEntity {
	type: EntityType;
	id: number;
	name: string;
}

export function resolveEntity(
	db: PipelineDB,
	query: string,
): ResolvedEntity | null {
	const q = query.toLowerCase();

	// Search people
	const people = db.select().from(schema.people).all();
	for (const p of people) {
		if (p.name.toLowerCase() === q || p.email?.toLowerCase() === q) {
			return { type: "person", id: p.id, name: p.name };
		}
	}

	// Search organizations
	const orgs = db.select().from(schema.organizations).all();
	for (const o of orgs) {
		if (o.name.toLowerCase() === q || o.domain?.toLowerCase() === q) {
			return { type: "organization", id: o.id, name: o.name };
		}
	}

	// Search deals
	const deals = db.select().from(schema.deals).all();
	for (const d of deals) {
		if (d.title.toLowerCase() === q) {
			return { type: "deal", id: d.id, name: d.title };
		}
	}

	// Fuzzy fallback — try partial matches
	for (const p of people) {
		if (p.name.toLowerCase().includes(q)) {
			return { type: "person", id: p.id, name: p.name };
		}
	}
	for (const o of orgs) {
		if (o.name.toLowerCase().includes(q)) {
			return { type: "organization", id: o.id, name: o.name };
		}
	}
	for (const d of deals) {
		if (d.title.toLowerCase().includes(q)) {
			return { type: "deal", id: d.id, name: d.title };
		}
	}

	return null;
}

export function createEdge(
	db: PipelineDB,
	fromType: string,
	fromId: number,
	toType: string,
	toId: number,
	relation: string,
) {
	return db
		.insert(schema.edges)
		.values({
			from_type: fromType,
			from_id: fromId,
			to_type: toType,
			to_id: toId,
			relation,
		})
		.returning()
		.get();
}

export function removeEdge(
	db: PipelineDB,
	fromType: string,
	fromId: number,
	toType: string,
	toId: number,
	relation: string,
) {
	db.delete(schema.edges)
		.where(
			and(
				eq(schema.edges.from_type, fromType),
				eq(schema.edges.from_id, fromId),
				eq(schema.edges.to_type, toType),
				eq(schema.edges.to_id, toId),
				eq(schema.edges.relation, relation),
			),
		)
		.run();
}

interface RelatedResult {
	contacts: Array<{ id: number; name: string; role: string | null }>;
	organizations: Array<{ id: number; name: string }>;
	deals: Array<{ id: number; title: string; stage: string }>;
	interactions: Array<{
		id: number;
		type: string;
		subject: string | null;
		occurred_at: string;
	}>;
	tasks: Array<{ id: number; title: string; due: string | null }>;
	edges: Array<{
		id: number;
		from_type: string;
		from_id: number;
		to_type: string;
		to_id: number;
		relation: string;
	}>;
}

export function getRelated(
	db: PipelineDB,
	entity: ResolvedEntity,
): RelatedResult {
	const result: RelatedResult = {
		contacts: [],
		organizations: [],
		deals: [],
		interactions: [],
		tasks: [],
		edges: [],
	};

	if (entity.type === "person") {
		// FK: contacts for this person
		const contacts = db
			.select({
				id: schema.contacts.id,
				name: schema.people.name,
				role: schema.contacts.role,
				org_id: schema.contacts.org_id,
			})
			.from(schema.contacts)
			.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
			.where(eq(schema.contacts.person_id, entity.id))
			.all();

		result.contacts = contacts.map((c) => ({
			id: c.id,
			name: c.name,
			role: c.role,
		}));

		// FK: orgs via contacts
		const orgIds = new Set(
			contacts.map((c) => c.org_id).filter(Boolean) as number[],
		);
		for (const orgId of orgIds) {
			const org = db
				.select()
				.from(schema.organizations)
				.where(eq(schema.organizations.id, orgId))
				.get();
			if (org) result.organizations.push({ id: org.id, name: org.name });
		}

		// FK: deals via contacts
		for (const contact of contacts) {
			const deals = db
				.select()
				.from(schema.deals)
				.where(eq(schema.deals.contact_id, contact.id))
				.all();
			for (const d of deals) {
				result.deals.push({ id: d.id, title: d.title, stage: d.stage });
			}

			// FK: interactions via contacts
			const interactions = db
				.select()
				.from(schema.interactions)
				.where(eq(schema.interactions.contact_id, contact.id))
				.all();
			for (const i of interactions) {
				result.interactions.push({
					id: i.id,
					type: i.type,
					subject: i.subject,
					occurred_at: i.occurred_at,
				});
			}

			// FK: tasks via contacts
			const tasks = db
				.select()
				.from(schema.tasks)
				.where(eq(schema.tasks.contact_id, contact.id))
				.all();
			for (const t of tasks) {
				result.tasks.push({ id: t.id, title: t.title, due: t.due });
			}
		}
	}

	if (entity.type === "organization") {
		// FK: contacts at this org
		const contacts = db
			.select({
				id: schema.contacts.id,
				name: schema.people.name,
				role: schema.contacts.role,
			})
			.from(schema.contacts)
			.innerJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
			.where(eq(schema.contacts.org_id, entity.id))
			.all();
		result.contacts = contacts;

		// FK: deals at this org
		const deals = db
			.select()
			.from(schema.deals)
			.where(eq(schema.deals.org_id, entity.id))
			.all();
		result.deals = deals.map((d) => ({
			id: d.id,
			title: d.title,
			stage: d.stage,
		}));
	}

	if (entity.type === "deal") {
		const deal = db
			.select()
			.from(schema.deals)
			.where(eq(schema.deals.id, entity.id))
			.get();
		if (deal) {
			if (deal.contact_id) {
				const contact = db
					.select({
						id: schema.contacts.id,
						name: schema.people.name,
						role: schema.contacts.role,
					})
					.from(schema.contacts)
					.innerJoin(
						schema.people,
						eq(schema.contacts.person_id, schema.people.id),
					)
					.where(eq(schema.contacts.id, deal.contact_id))
					.get();
				if (contact) result.contacts.push(contact);
			}
			if (deal.org_id) {
				const org = db
					.select()
					.from(schema.organizations)
					.where(eq(schema.organizations.id, deal.org_id))
					.get();
				if (org) result.organizations.push({ id: org.id, name: org.name });
			}

			const interactions = db
				.select()
				.from(schema.interactions)
				.where(eq(schema.interactions.deal_id, entity.id))
				.all();
			result.interactions = interactions.map((i) => ({
				id: i.id,
				type: i.type,
				subject: i.subject,
				occurred_at: i.occurred_at,
			}));

			const tasks = db
				.select()
				.from(schema.tasks)
				.where(eq(schema.tasks.deal_id, entity.id))
				.all();
			result.tasks = tasks.map((t) => ({
				id: t.id,
				title: t.title,
				due: t.due,
			}));
		}
	}

	// Walk explicit edges in both directions
	const outEdges = db
		.select()
		.from(schema.edges)
		.where(
			and(
				eq(schema.edges.from_type, entity.type),
				eq(schema.edges.from_id, entity.id),
			),
		)
		.all();

	const inEdges = db
		.select()
		.from(schema.edges)
		.where(
			and(
				eq(schema.edges.to_type, entity.type),
				eq(schema.edges.to_id, entity.id),
			),
		)
		.all();

	result.edges = [...outEdges, ...inEdges];

	return result;
}
