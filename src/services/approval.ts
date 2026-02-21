import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { getActionHandler } from "./action-handlers.js";

export function listPendingActions(db: PipelineDB) {
	return db
		.select()
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.status, "pending"))
		.all();
}

export async function approveAction(
	db: PipelineDB,
	actionId: number,
): Promise<string> {
	const action = db
		.select()
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.id, actionId))
		.get();

	if (!action) throw new Error(`Action ${actionId} not found`);
	if (action.status !== "pending")
		throw new Error(`Action ${actionId} is already ${action.status}`);

	const payload = (action.payload || {}) as Record<string, unknown>;
	let result = "";

	const handler = getActionHandler(action.action_type);
	if (handler) {
		result = await handler.execute(db, payload);
	} else {
		result = `Unknown action type: ${action.action_type}`;
	}

	// Mark as approved
	db.update(schema.pendingActions)
		.set({ status: "approved", resolved_at: new Date().toISOString() })
		.where(eq(schema.pendingActions.id, actionId))
		.run();

	// Write outcome to agent_memory if linked
	if (action.memory_id) {
		try {
			db.update(schema.agentMemory)
				.set({ outcome: "approved" })
				.where(eq(schema.agentMemory.id, action.memory_id))
				.run();
		} catch {
			/* agent_memory row may not exist yet */
		}
	}

	return result;
}

export function rejectAction(
	db: PipelineDB,
	actionId: number,
	reason?: string,
): void {
	db.update(schema.pendingActions)
		.set({ status: "rejected", resolved_at: new Date().toISOString() })
		.where(eq(schema.pendingActions.id, actionId))
		.run();

	// Write outcome to agent_memory if linked
	const action = db
		.select()
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.id, actionId))
		.get();

	if (action?.memory_id) {
		try {
			db.update(schema.agentMemory)
				.set({
					outcome: "rejected",
					human_feedback: reason || null,
				})
				.where(eq(schema.agentMemory.id, action.memory_id))
				.run();
		} catch {
			/* agent_memory row may not exist yet */
		}
	}
}

export async function approveAll(db: PipelineDB): Promise<string[]> {
	const pending = listPendingActions(db);
	const results: string[] = [];
	for (const action of pending) {
		const result = await approveAction(db, action.id);
		results.push(`#${action.id}: ${result}`);
	}
	return results;
}
