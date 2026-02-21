import type { PipelineDB } from "../db/index.js";
import { getContactsForFuzzy } from "../services/contacts.js";
import { getDealsForFuzzy } from "../services/deals.js";
import { getOrgsForFuzzy } from "../services/organizations.js";
import { fuzzyResolve } from "./fuzzy.js";

export async function resolveContactId(
	db: PipelineDB,
	query: string,
): Promise<{ id: number; name: string }> {
	const contacts = getContactsForFuzzy(db);
	return fuzzyResolve(contacts, query, "contact", ["name", "email"]);
}

export async function resolveDealId(
	db: PipelineDB,
	query: string,
): Promise<number> {
	const deals = getDealsForFuzzy(db);
	const match = await fuzzyResolve(deals, query, "deal");
	return match.id;
}

export async function resolveOrgId(
	db: PipelineDB,
	query: string,
): Promise<number> {
	const orgs = getOrgsForFuzzy(db);
	const match = await fuzzyResolve(orgs, query, "organization");
	return match.id;
}
