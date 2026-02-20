import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { moveDeal } from "./deals.js";

export function listPendingActions(db: PipelineDB) {
	return db
		.select()
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.status, "pending"))
		.all();
}

export function approveAction(db: PipelineDB, actionId: number): string {
	const action = db
		.select()
		.from(schema.pendingActions)
		.where(eq(schema.pendingActions.id, actionId))
		.get();

	if (!action) throw new Error(`Action ${actionId} not found`);
	if (action.status !== "pending") throw new Error(`Action ${actionId} is already ${action.status}`);

	const payload = (action.payload || {}) as Record<string, unknown>;
	let result = "";

	switch (action.action_type) {
		case "send_email":
			// For now, just log it — actual sending in Phase 2
			result = `Email logged: to=${payload.to}, subject=${payload.subject || "(no subject)"}`;
			if (payload.to && typeof payload.to === "string") {
				// Create an interaction note
				db.insert(schema.interactions)
					.values({
						type: "note",
						body: `[Agent proposed email] To: ${payload.to}. ${payload.body || ""}`,
					})
					.run();
			}
			break;

		case "update_stage":
			if (payload.deal_id && payload.stage) {
				moveDeal(db, payload.deal_id as number, payload.stage as string);
				result = `Moved deal ${payload.deal_id} to stage ${payload.stage}`;
			}
			break;

		case "create_task":
			if (payload.title) {
				const task = db
					.insert(schema.tasks)
					.values({
						title: payload.title as string,
						contact_id: payload.contact_id as number | undefined,
						deal_id: payload.deal_id as number | undefined,
						due: payload.due as string | undefined,
					})
					.returning()
					.get();
				result = `Created task: ${task.title} (id: ${task.id})`;
			}
			break;

		case "log_note":
			if (payload.body) {
				const interaction = db
					.insert(schema.interactions)
					.values({
						type: "note",
						contact_id: payload.contact_id as number | undefined,
						deal_id: payload.deal_id as number | undefined,
						body: payload.body as string,
					})
					.returning()
					.get();
				result = `Logged note (id: ${interaction.id})`;
			}
			break;

		case "create_edge":
			if (payload.from_type && payload.to_type) {
				const edge = db
					.insert(schema.edges)
					.values({
						from_type: payload.from_type as string,
						from_id: payload.from_id as number,
						to_type: payload.to_type as string,
						to_id: payload.to_id as number,
						relation: payload.relation as string,
					})
					.returning()
					.get();
				result = `Created edge (id: ${edge.id})`;
			}
			break;

		default:
			result = `Unknown action type: ${action.action_type}`;
	}

	// Mark as approved
	db.update(schema.pendingActions)
		.set({ status: "approved", resolved_at: new Date().toISOString() })
		.where(eq(schema.pendingActions.id, actionId))
		.run();

	return result;
}

export function rejectAction(db: PipelineDB, actionId: number): void {
	db.update(schema.pendingActions)
		.set({ status: "rejected", resolved_at: new Date().toISOString() })
		.where(eq(schema.pendingActions.id, actionId))
		.run();
}

export function approveAll(db: PipelineDB): string[] {
	const pending = listPendingActions(db);
	const results: string[] = [];
	for (const action of pending) {
		const result = approveAction(db, action.id);
		results.push(`#${action.id}: ${result}`);
	}
	return results;
}
