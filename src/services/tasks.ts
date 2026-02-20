import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

export interface AddTaskInput {
	title: string;
	contactId?: number;
	dealId?: number;
	due?: string;
}

export function addTask(db: PipelineDB, input: AddTaskInput) {
	return db
		.insert(schema.tasks)
		.values({
			title: input.title,
			contact_id: input.contactId,
			deal_id: input.dealId,
			due: input.due,
		})
		.returning()
		.get();
}

export function listTasks(
	db: PipelineDB,
	filters?: {
		dueToday?: boolean;
		overdue?: boolean;
		contactId?: number;
		dealId?: number;
	},
) {
	let rows = db
		.select({
			id: schema.tasks.id,
			title: schema.tasks.title,
			due: schema.tasks.due,
			completed: schema.tasks.completed,
			completed_at: schema.tasks.completed_at,
			contact_name: schema.people.name,
			deal_title: schema.deals.title,
			created_at: schema.tasks.created_at,
		})
		.from(schema.tasks)
		.leftJoin(
			schema.contacts,
			eq(schema.tasks.contact_id, schema.contacts.id),
		)
		.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.leftJoin(schema.deals, eq(schema.tasks.deal_id, schema.deals.id))
		.all();

	// Only show incomplete tasks by default
	rows = rows.filter((r) => !r.completed);

	const today = new Date().toISOString().split("T")[0];

	if (filters?.dueToday) {
		rows = rows.filter((r) => r.due === today);
	}
	if (filters?.overdue) {
		rows = rows.filter((r) => r.due != null && r.due < today);
	}
	if (filters?.contactId) {
		const contactTaskIds = db
			.select({ id: schema.tasks.id })
			.from(schema.tasks)
			.where(eq(schema.tasks.contact_id, filters.contactId))
			.all()
			.map((t) => t.id);
		rows = rows.filter((r) => contactTaskIds.includes(r.id));
	}
	if (filters?.dealId) {
		const dealTaskIds = db
			.select({ id: schema.tasks.id })
			.from(schema.tasks)
			.where(eq(schema.tasks.deal_id, filters.dealId))
			.all()
			.map((t) => t.id);
		rows = rows.filter((r) => dealTaskIds.includes(r.id));
	}

	return rows;
}

export function completeTask(db: PipelineDB, taskId: number) {
	const now = new Date().toISOString();
	db.update(schema.tasks)
		.set({ completed: true, completed_at: now, updated_at: now })
		.where(eq(schema.tasks.id, taskId))
		.run();
}

export function getTasksForFuzzy(db: PipelineDB) {
	return db
		.select({ id: schema.tasks.id, name: schema.tasks.title })
		.from(schema.tasks)
		.where(eq(schema.tasks.completed, false))
		.all();
}
