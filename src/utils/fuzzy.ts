import Fuse from "fuse.js";
import { select } from "@inquirer/prompts";

interface FuzzyItem {
	id: number;
	name: string;
	[key: string]: unknown;
}

interface FuzzyResult<T extends FuzzyItem> {
	item: T;
	score: number;
}

export function fuzzySearch<T extends FuzzyItem>(
	items: T[],
	query: string,
	keys: string[] = ["name"],
): FuzzyResult<T>[] {
	const fuse = new Fuse(items, {
		keys,
		threshold: 0.4,
		includeScore: true,
	});
	return fuse.search(query).map((r) => ({
		item: r.item,
		score: r.score ?? 1,
	}));
}

export async function fuzzyResolve<T extends FuzzyItem>(
	items: T[],
	query: string,
	entityType: string,
	keys: string[] = ["name"],
): Promise<T> {
	// Try exact match first
	const exact = items.find(
		(i) => i.name.toLowerCase() === query.toLowerCase(),
	);
	if (exact) return exact;

	const results = fuzzySearch(items, query, keys);

	if (results.length === 0) {
		throw new Error(`No ${entityType} found matching "${query}"`);
	}

	if (results.length === 1) {
		return results[0].item;
	}

	// Non-interactive mode (piped input): use best match
	if (!process.stdin.isTTY) {
		return results[0].item;
	}

	// Interactive: let user choose
	const answer = await select({
		message: `Multiple ${entityType}s match "${query}". Which one?`,
		choices: results.slice(0, 10).map((r) => ({
			name: r.item.name,
			value: r.item.id,
			description: `Score: ${(1 - r.score).toFixed(2)}`,
		})),
	});

	const selected = items.find((i) => i.id === answer);
	if (!selected) throw new Error(`${entityType} not found`);
	return selected;
}
