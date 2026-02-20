import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

export interface LogInteractionInput {
	contactId: number;
	type: string;
	direction?: string;
	subject?: string;
	body?: string;
	dealId?: number;
}

export function logInteraction(db: PipelineDB, input: LogInteractionInput) {
	// Update contact's updated_at
	db.update(schema.contacts)
		.set({ updated_at: new Date().toISOString() })
		.where(eq(schema.contacts.id, input.contactId))
		.run();

	return db
		.insert(schema.interactions)
		.values({
			contact_id: input.contactId,
			deal_id: input.dealId,
			type: input.type,
			direction: input.direction,
			subject: input.subject,
			body: input.body,
		})
		.returning()
		.get();
}

export function listInteractions(
	db: PipelineDB,
	filters?: {
		contactId?: number;
		type?: string;
		lastDays?: number;
		dealId?: number;
	},
) {
	let rows = db
		.select({
			id: schema.interactions.id,
			type: schema.interactions.type,
			direction: schema.interactions.direction,
			subject: schema.interactions.subject,
			body: schema.interactions.body,
			occurred_at: schema.interactions.occurred_at,
			contact_name: schema.people.name,
			deal_title: schema.deals.title,
		})
		.from(schema.interactions)
		.leftJoin(
			schema.contacts,
			eq(schema.interactions.contact_id, schema.contacts.id),
		)
		.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(schema.deals, eq(schema.interactions.deal_id, schema.deals.id))
		.all();

	if (filters?.contactId) {
		rows = rows.filter(
			(r) =>
				db
					.select()
					.from(schema.interactions)
					.where(eq(schema.interactions.contact_id, filters.contactId!))
					.all()
					.map((i) => i.id)
					.includes(r.id),
		);
	}
	if (filters?.type) {
		rows = rows.filter((r) => r.type === filters.type);
	}
	if (filters?.dealId) {
		rows = rows.filter(
			(r) =>
				db
					.select()
					.from(schema.interactions)
					.where(eq(schema.interactions.deal_id, filters.dealId!))
					.all()
					.map((i) => i.id)
					.includes(r.id),
		);
	}
	if (filters?.lastDays) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - filters.lastDays);
		const cutoffStr = cutoff.toISOString();
		rows = rows.filter((r) => r.occurred_at >= cutoffStr);
	}

	return rows;
}
