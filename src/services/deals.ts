import { and, eq, lte } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { loadConfig } from "../config.js";

interface AddDealInput {
	title: string;
	contactId?: number;
	orgId?: number;
	value?: number;
	stage?: string;
	priority?: string;
	expectedClose?: string;
}

export function addDeal(db: PipelineDB, input: AddDealInput) {
	const config = loadConfig();
	const stages = config.pipeline.stages;

	const stage = input.stage || stages[0];
	if (!stages.includes(stage)) {
		throw new Error(
			`Invalid stage "${stage}". Valid stages: ${stages.join(", ")}`,
		);
	}

	return db
		.insert(schema.deals)
		.values({
			title: input.title,
			contact_id: input.contactId,
			org_id: input.orgId,
			value: input.value,
			stage,
			priority: input.priority || "medium",
			expected_close: input.expectedClose,
		})
		.returning()
		.get();
}

export function listDeals(
	db: PipelineDB,
	filters?: {
		stage?: string;
		priority?: string;
		closingDays?: number;
		minValue?: number;
	},
) {
	let rows = db
		.select({
			id: schema.deals.id,
			title: schema.deals.title,
			value: schema.deals.value,
			stage: schema.deals.stage,
			priority: schema.deals.priority,
			expected_close: schema.deals.expected_close,
			won: schema.deals.won,
			contact_name: schema.people.name,
			org_name: schema.organizations.name,
			created_at: schema.deals.created_at,
		})
		.from(schema.deals)
		.leftJoin(schema.contacts, eq(schema.deals.contact_id, schema.contacts.id))
		.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(
			schema.organizations,
			eq(schema.deals.org_id, schema.organizations.id),
		)
		.all();

	if (filters?.stage) {
		rows = rows.filter((r) => r.stage === filters.stage);
	}
	if (filters?.priority) {
		rows = rows.filter((r) => r.priority === filters.priority);
	}
	if (filters?.minValue) {
		rows = rows.filter((r) => (r.value || 0) >= filters.minValue!);
	}
	if (filters?.closingDays) {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() + filters.closingDays);
		const cutoffStr = cutoff.toISOString().split("T")[0];
		rows = rows.filter(
			(r) => r.expected_close && r.expected_close <= cutoffStr,
		);
	}

	return rows;
}

export function moveDeal(db: PipelineDB, dealId: number, stage: string) {
	const config = loadConfig();
	if (!config.pipeline.stages.includes(stage)) {
		throw new Error(
			`Invalid stage "${stage}". Valid stages: ${config.pipeline.stages.join(", ")}`,
		);
	}

	db.update(schema.deals)
		.set({ stage, updated_at: new Date().toISOString() })
		.where(eq(schema.deals.id, dealId))
		.run();
}

export function closeDeal(
	db: PipelineDB,
	dealId: number,
	won: boolean,
	reason?: string,
) {
	const stage = won ? "closed_won" : "closed_lost";
	const now = new Date().toISOString();

	db.update(schema.deals)
		.set({
			stage,
			won,
			close_reason: reason,
			closed_at: now,
			updated_at: now,
		})
		.where(eq(schema.deals.id, dealId))
		.run();
}

export function addDealNote(
	db: PipelineDB,
	dealId: number,
	body: string,
) {
	const deal = db
		.select()
		.from(schema.deals)
		.where(eq(schema.deals.id, dealId))
		.get();

	return db
		.insert(schema.interactions)
		.values({
			deal_id: dealId,
			contact_id: deal?.contact_id ?? undefined,
			type: "note",
			body,
		})
		.returning()
		.get();
}

export function pipelineView(db: PipelineDB) {
	const config = loadConfig();
	const stages = config.pipeline.stages;

	const deals = db.select().from(schema.deals).all();

	const grouped: Record<string, typeof deals> = {};
	for (const stage of stages) {
		grouped[stage] = [];
	}
	for (const deal of deals) {
		if (!grouped[deal.stage]) grouped[deal.stage] = [];
		grouped[deal.stage].push(deal);
	}

	return { stages, grouped };
}

export function getDealsForFuzzy(db: PipelineDB) {
	return db
		.select({ id: schema.deals.id, name: schema.deals.title })
		.from(schema.deals)
		.all();
}
