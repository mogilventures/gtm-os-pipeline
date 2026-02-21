import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

interface RecordMemoryInput {
	agentName: string;
	runId: string;
	contactId?: number;
	dealId?: number;
	actionType: string;
	payload?: Record<string, unknown>;
	reasoning?: string;
}

export function recordMemory(db: PipelineDB, input: RecordMemoryInput) {
	return db
		.insert(schema.agentMemory)
		.values({
			agent_name: input.agentName,
			run_id: input.runId,
			contact_id: input.contactId,
			deal_id: input.dealId,
			action_type: input.actionType,
			payload: input.payload,
			reasoning: input.reasoning,
		})
		.returning()
		.get();
}

export function recallMemory(
	db: PipelineDB,
	filters?: {
		agentName?: string;
		contactId?: number;
		dealId?: number;
		outcome?: string;
		limit?: number;
	},
) {
	let rows = db.select().from(schema.agentMemory).all();

	if (filters?.agentName) {
		rows = rows.filter((r) => r.agent_name === filters.agentName);
	}
	if (filters?.contactId) {
		rows = rows.filter((r) => r.contact_id === filters.contactId);
	}
	if (filters?.dealId) {
		rows = rows.filter((r) => r.deal_id === filters.dealId);
	}
	if (filters?.outcome) {
		rows = rows.filter((r) => r.outcome === filters.outcome);
	}

	rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
	return rows.slice(0, filters?.limit ?? 50);
}

export function updateOutcome(
	db: PipelineDB,
	memoryId: number,
	outcome: "approved" | "rejected",
	humanFeedback?: string,
) {
	db.update(schema.agentMemory)
		.set({
			outcome,
			human_feedback: humanFeedback || null,
		})
		.where(eq(schema.agentMemory.id, memoryId))
		.run();
}
