import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { moveDeal } from "./deals.js";

export interface ActionHandler {
	label: string;
	validate(payload: Record<string, unknown>): string | null;
	execute(db: PipelineDB, payload: Record<string, unknown>): Promise<string>;
}

const registry = new Map<string, ActionHandler>();

export function registerActionHandler(
	actionType: string,
	handler: ActionHandler,
): void {
	registry.set(actionType, handler);
}

export function getActionHandler(
	actionType: string,
): ActionHandler | undefined {
	return registry.get(actionType);
}

export function getRegisteredActionTypes(): string[] {
	return [...registry.keys()];
}

// ── Built-in handlers ───────────────────────────────────────────

registerActionHandler("send_email", {
	label: "Send an email",
	validate(payload) {
		if (!payload.to) return "Missing 'to' field";
		return null;
	},
	async execute(db, payload) {
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

			return `Email sent via ${emailResult.provider} (${emailResult.id}): to=${to}, subject=${subject}`;
		} catch (error) {
			const errMsg = error instanceof Error ? error.message : String(error);
			db.insert(schema.interactions)
				.values({
					contact_id: contactId,
					type: "note",
					body: `[Email draft — sending failed] To: ${to}, Subject: ${subject}\n\n${body}\n\nError: ${errMsg}`,
				})
				.run();
			return `Email sending failed (logged as draft): ${errMsg}`;
		}
	},
});

registerActionHandler("update_stage", {
	label: "Update a deal's stage",
	validate(payload) {
		if (!payload.deal_id || !payload.stage)
			return "Missing 'deal_id' or 'stage'";
		return null;
	},
	async execute(db, payload) {
		moveDeal(db, payload.deal_id as number, payload.stage as string);
		return `Moved deal ${payload.deal_id} to stage ${payload.stage}`;
	},
});

registerActionHandler("create_task", {
	label: "Create a new task",
	validate(payload) {
		if (!payload.title) return "Missing 'title'";
		return null;
	},
	async execute(db, payload) {
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
		return `Created task: ${task.title} (id: ${task.id})`;
	},
});

registerActionHandler("log_note", {
	label: "Log a note",
	validate(payload) {
		if (!payload.body) return "Missing 'body'";
		return null;
	},
	async execute(db, payload) {
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
		return `Logged note (id: ${interaction.id})`;
	},
});

registerActionHandler("create_edge", {
	label: "Create a relationship edge",
	validate(payload) {
		if (!payload.from_type || !payload.to_type)
			return "Missing 'from_type' or 'to_type'";
		return null;
	},
	async execute(db, payload) {
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
		return `Created edge (id: ${edge.id})`;
	},
});

registerActionHandler("complete_task", {
	label: "Mark a task as completed",
	validate(payload) {
		if (!payload.task_id) return "Missing 'task_id'";
		return null;
	},
	async execute(db, payload) {
		const { completeTask } = await import("./tasks.js");
		completeTask(db, payload.task_id as number);
		return `Completed task ${payload.task_id}`;
	},
});

registerActionHandler("update_warmth", {
	label: "Update a contact's warmth",
	validate(payload) {
		if (!payload.contact_id || !payload.warmth)
			return "Missing 'contact_id' or 'warmth'";
		const valid = ["cold", "warm", "hot"];
		if (!valid.includes(payload.warmth as string))
			return `Invalid warmth: must be one of ${valid.join(", ")}`;
		return null;
	},
	async execute(db, payload) {
		db.update(schema.contacts)
			.set({
				warmth: payload.warmth as string,
				updated_at: new Date().toISOString(),
			})
			.where(eq(schema.contacts.id, payload.contact_id as number))
			.run();
		return `Updated contact ${payload.contact_id} warmth to ${payload.warmth}`;
	},
});

registerActionHandler("update_priority", {
	label: "Update a deal's priority",
	validate(payload) {
		if (!payload.deal_id || !payload.priority)
			return "Missing 'deal_id' or 'priority'";
		const valid = ["low", "medium", "high"];
		if (!valid.includes(payload.priority as string))
			return `Invalid priority: must be one of ${valid.join(", ")}`;
		return null;
	},
	async execute(db, payload) {
		db.update(schema.deals)
			.set({
				priority: payload.priority as string,
				updated_at: new Date().toISOString(),
			})
			.where(eq(schema.deals.id, payload.deal_id as number))
			.run();
		return `Updated deal ${payload.deal_id} priority to ${payload.priority}`;
	},
});
