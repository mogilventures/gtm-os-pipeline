import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { getContactsForFuzzy } from "./contacts.js";
import { getDealsForFuzzy } from "./deals.js";
import { getOrgsForFuzzy } from "./organizations.js";
import { getTasksForFuzzy } from "./tasks.js";
import { fuzzySearch } from "../utils/fuzzy.js";

interface SearchResult {
	type: "contact" | "deal" | "organization" | "task";
	id: number;
	name: string;
	score: number;
	detail?: string;
}

interface SearchResults {
	results: SearchResult[];
	query: string;
}

export function searchAll(db: PipelineDB, query: string): SearchResults {
	const results: SearchResult[] = [];

	// Search contacts (by name and email)
	const contacts = getContactsForFuzzy(db);
	const contactMatches = fuzzySearch(contacts, query, ["name", "email"]);
	for (const m of contactMatches) {
		const contact = db
			.select({
				role: schema.contacts.role,
				org_name: schema.organizations.name,
			})
			.from(schema.contacts)
			.leftJoin(
				schema.organizations,
				eq(schema.contacts.org_id, schema.organizations.id),
			)
			.where(eq(schema.contacts.id, m.item.id))
			.get();
		const parts: string[] = [];
		if (contact?.role) parts.push(contact.role);
		if (contact?.org_name) parts.push(`at ${contact.org_name}`);
		results.push({
			type: "contact",
			id: m.item.id,
			name: m.item.name,
			score: m.score,
			detail: parts.length > 0 ? parts.join(" ") : undefined,
		});
	}

	// Search deals
	const deals = getDealsForFuzzy(db);
	const dealMatches = fuzzySearch(deals, query);
	for (const m of dealMatches) {
		const deal = db
			.select({
				stage: schema.deals.stage,
				value: schema.deals.value,
			})
			.from(schema.deals)
			.where(eq(schema.deals.id, m.item.id))
			.get();
		const parts: string[] = [];
		if (deal?.stage) parts.push(deal.stage);
		if (deal?.value) parts.push(`$${deal.value.toLocaleString()}`);
		results.push({
			type: "deal",
			id: m.item.id,
			name: m.item.name,
			score: m.score,
			detail: parts.length > 0 ? parts.join(", ") : undefined,
		});
	}

	// Search organizations
	const orgs = getOrgsForFuzzy(db);
	const orgMatches = fuzzySearch(orgs, query);
	for (const m of orgMatches) {
		const org = db
			.select({ industry: schema.organizations.industry })
			.from(schema.organizations)
			.where(eq(schema.organizations.id, m.item.id))
			.get();
		results.push({
			type: "organization",
			id: m.item.id,
			name: m.item.name,
			score: m.score,
			detail: org?.industry ?? undefined,
		});
	}

	// Search tasks
	const tasks = getTasksForFuzzy(db);
	const taskMatches = fuzzySearch(tasks, query);
	for (const m of taskMatches) {
		const task = db
			.select({ due: schema.tasks.due })
			.from(schema.tasks)
			.where(eq(schema.tasks.id, m.item.id))
			.get();
		results.push({
			type: "task",
			id: m.item.id,
			name: m.item.name,
			score: m.score,
			detail: task?.due ? `due ${task.due}` : undefined,
		});
	}

	// Sort by score (lower = better match in fuse.js)
	results.sort((a, b) => a.score - b.score);

	return { results: results.slice(0, 20), query };
}
