import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

interface TimelineEvent {
	timestamp: string;
	type: "interaction" | "task_completed" | "deal_created" | "deal_closed";
	summary: string;
	entity_type: string;
	entity_id: number;
	entity_name: string;
}

interface TimelineFilters {
	lastDays?: number;
	type?: string;
	contactId?: number;
	limit?: number;
}

export function getTimeline(
	db: PipelineDB,
	filters?: TimelineFilters,
): TimelineEvent[] {
	const lastDays = filters?.lastDays ?? 30;
	const limit = filters?.limit ?? 50;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - lastDays);
	const cutoffStr = cutoff.toISOString();

	const events: TimelineEvent[] = [];

	// Interactions
	const interactions = db
		.select({
			id: schema.interactions.id,
			type: schema.interactions.type,
			direction: schema.interactions.direction,
			subject: schema.interactions.subject,
			occurred_at: schema.interactions.occurred_at,
			contact_name: schema.people.name,
			contact_id: schema.interactions.contact_id,
		})
		.from(schema.interactions)
		.leftJoin(
			schema.contacts,
			eq(schema.interactions.contact_id, schema.contacts.id),
		)
		.leftJoin(schema.people, eq(schema.contacts.person_id, schema.people.id))
		.all()
		.filter((r) => r.occurred_at >= cutoffStr);

	for (const i of interactions) {
		if (filters?.contactId && i.contact_id !== filters.contactId) continue;
		const contactPart = i.contact_name
			? ` ${i.direction === "inbound" ? "from" : "to"} ${i.contact_name}`
			: "";
		const subjectPart = i.subject ? `: ${i.subject}` : "";
		events.push({
			timestamp: i.occurred_at,
			type: "interaction",
			summary: `${capitalize(i.type)}${contactPart}${subjectPart}`,
			entity_type: "interaction",
			entity_id: i.id,
			entity_name: i.subject || i.type,
		});
	}

	// Completed tasks
	const completedTasks = db
		.select({
			id: schema.tasks.id,
			title: schema.tasks.title,
			completed_at: schema.tasks.completed_at,
			contact_id: schema.tasks.contact_id,
		})
		.from(schema.tasks)
		.where(eq(schema.tasks.completed, true))
		.all()
		.filter((r) => r.completed_at && r.completed_at >= cutoffStr);

	for (const t of completedTasks) {
		if (filters?.contactId && t.contact_id !== filters.contactId) continue;
		events.push({
			timestamp: t.completed_at!,
			type: "task_completed",
			summary: `"${t.title}" completed`,
			entity_type: "task",
			entity_id: t.id,
			entity_name: t.title,
		});
	}

	// Deals created
	const dealsCreated = db
		.select({
			id: schema.deals.id,
			title: schema.deals.title,
			value: schema.deals.value,
			created_at: schema.deals.created_at,
			contact_id: schema.deals.contact_id,
		})
		.from(schema.deals)
		.all()
		.filter((r) => r.created_at >= cutoffStr);

	for (const d of dealsCreated) {
		if (filters?.contactId && d.contact_id !== filters.contactId) continue;
		const valuePart = d.value ? ` ($${d.value.toLocaleString()})` : "";
		events.push({
			timestamp: d.created_at,
			type: "deal_created",
			summary: `New deal: ${d.title}${valuePart}`,
			entity_type: "deal",
			entity_id: d.id,
			entity_name: d.title,
		});
	}

	// Deals closed
	const dealsClosed = db
		.select({
			id: schema.deals.id,
			title: schema.deals.title,
			value: schema.deals.value,
			won: schema.deals.won,
			closed_at: schema.deals.closed_at,
			contact_id: schema.deals.contact_id,
		})
		.from(schema.deals)
		.all()
		.filter((r) => r.closed_at && r.closed_at >= cutoffStr);

	for (const d of dealsClosed) {
		if (filters?.contactId && d.contact_id !== filters.contactId) continue;
		const outcome = d.won ? "won" : "lost";
		const valuePart = d.value ? ` ($${d.value.toLocaleString()})` : "";
		events.push({
			timestamp: d.closed_at!,
			type: "deal_closed",
			summary: `${d.title} closed ${outcome}${valuePart}`,
			entity_type: "deal",
			entity_id: d.id,
			entity_name: d.title,
		});
	}

	// Filter by type
	let filtered = events;
	if (filters?.type) {
		filtered = filtered.filter((e) => e.type === filters.type);
	}

	// Sort newest first
	filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

	return filtered.slice(0, limit);
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
