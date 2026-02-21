import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { listContacts } from "./contacts.js";
import { listTasks } from "./tasks.js";

export function emitEvent(
	db: PipelineDB,
	eventType: string,
	entityType: string,
	entityId: number,
	payload?: Record<string, unknown>,
) {
	return db
		.insert(schema.events)
		.values({
			event_type: eventType,
			entity_type: entityType,
			entity_id: entityId,
			payload: payload || {},
		})
		.returning()
		.get();
}

export function getUnprocessedEvents(db: PipelineDB) {
	return db
		.select()
		.from(schema.events)
		.where(eq(schema.events.processed, false))
		.all();
}

export function markEventProcessed(db: PipelineDB, eventId: number) {
	db.update(schema.events)
		.set({ processed: true })
		.where(eq(schema.events.id, eventId))
		.run();
}

export function getHooksForEvent(db: PipelineDB, eventType: string) {
	return db
		.select()
		.from(schema.eventHooks)
		.where(eq(schema.eventHooks.event_type, eventType))
		.all()
		.filter((h) => h.enabled);
}

export function addHook(db: PipelineDB, eventType: string, agentName: string) {
	return db
		.insert(schema.eventHooks)
		.values({ event_type: eventType, agent_name: agentName })
		.returning()
		.get();
}

export function removeHook(
	db: PipelineDB,
	eventType: string,
	agentName: string,
) {
	const hook = db
		.select()
		.from(schema.eventHooks)
		.all()
		.find((h) => h.event_type === eventType && h.agent_name === agentName);
	if (!hook)
		throw new Error(
			`No hook found for event "${eventType}" → agent "${agentName}"`,
		);
	db.delete(schema.eventHooks).where(eq(schema.eventHooks.id, hook.id)).run();
}

export function listHooks(db: PipelineDB) {
	return db.select().from(schema.eventHooks).all();
}

/**
 * Scan for time-based events (stale contacts, overdue tasks) and emit them.
 * Call this periodically (e.g., from schedule:run).
 */
export function scanForTimeEvents(db: PipelineDB): number {
	let emitted = 0;

	// Stale contacts (no update in 14 days)
	const staleContacts = listContacts(db, { staleDays: 14 });
	for (const contact of staleContacts) {
		// Only emit if we haven't already emitted a recent unprocessed event for this contact
		const existing = db
			.select()
			.from(schema.events)
			.all()
			.find(
				(e) =>
					e.event_type === "contact_stale" &&
					e.entity_id === contact.id &&
					!e.processed,
			);
		if (!existing) {
			emitEvent(db, "contact_stale", "contact", contact.id, {
				name: contact.name,
				last_updated: contact.updated_at,
			});
			emitted++;
		}
	}

	// Overdue tasks
	const overdueTasks = listTasks(db, { overdue: true });
	for (const task of overdueTasks) {
		const existing = db
			.select()
			.from(schema.events)
			.all()
			.find(
				(e) =>
					e.event_type === "task_overdue" &&
					e.entity_id === task.id &&
					!e.processed,
			);
		if (!existing) {
			emitEvent(db, "task_overdue", "task", task.id, {
				title: task.title,
				due: task.due,
			});
			emitted++;
		}
	}

	return emitted;
}

interface ProcessResult {
	eventId: number;
	eventType: string;
	agentName: string;
	status: "triggered" | "skipped";
}

/**
 * Process unprocessed events: for each event, find matching hooks and trigger agents.
 * Returns a list of what was triggered (does not actually run agents — that's up to the caller).
 */
export function processEvents(db: PipelineDB): ProcessResult[] {
	const events = getUnprocessedEvents(db);
	const results: ProcessResult[] = [];

	for (const event of events) {
		const hooks = getHooksForEvent(db, event.event_type);

		if (hooks.length === 0) {
			// No hooks for this event type — mark processed anyway
			markEventProcessed(db, event.id);
			continue;
		}

		for (const hook of hooks) {
			results.push({
				eventId: event.id,
				eventType: event.event_type,
				agentName: hook.agent_name,
				status: "triggered",
			});
		}

		markEventProcessed(db, event.id);
	}

	return results;
}
