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

export async function approveAction(db: PipelineDB, actionId: number): Promise<string> {
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
		case "send_email": {
			const to = payload.to as string;
			const subject = (payload.subject as string) || "(no subject)";
			const body = (payload.body as string) || "";
			const contactId = payload.contact_id as number | undefined;

			try {
				const { sendEmail } = await import("./email.js");
				const emailResult = await sendEmail({ to, subject, body });

				db.insert(schema.interactions)
					.values({
						contact_id: contactId,
						deal_id: payload.deal_id as number | undefined,
						type: "email",
						direction: "outbound",
						subject,
						body,
						message_id: emailResult.id,
					})
					.run();

				if (contactId) {
					db.update(schema.contacts)
						.set({ updated_at: new Date().toISOString() })
						.where(eq(schema.contacts.id, contactId))
						.run();
				}

				result = `Email sent via ${emailResult.provider} (${emailResult.id}): to=${to}, subject=${subject}`;
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				db.insert(schema.interactions)
					.values({
						contact_id: contactId,
						type: "note",
						body: `[Email draft — sending failed] To: ${to}, Subject: ${subject}\n\n${body}\n\nError: ${errMsg}`,
					})
					.run();
				result = `Email sending failed (logged as draft): ${errMsg}`;
			}
			break;
		}

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

export async function approveAll(db: PipelineDB): Promise<string[]> {
	const pending = listPendingActions(db);
	const results: string[] = [];
	for (const action of pending) {
		const result = await approveAction(db, action.id);
		results.push(`#${action.id}: ${result}`);
	}
	return results;
}
