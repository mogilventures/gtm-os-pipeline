/**
 * Parse relative and absolute date strings into ISO date strings.
 *
 * Supports: "today", "tomorrow", "yesterday", "next week", "next monday",
 * "in 3 days", "3d", "7d", and ISO dates like "2026-02-25".
 */
export function parseDate(input: string): string {
	const trimmed = input.trim().toLowerCase();
	const now = new Date();

	// ISO date (YYYY-MM-DD)
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return trimmed;
	}

	// Relative keywords
	if (trimmed === "today") {
		return toISODate(now);
	}
	if (trimmed === "tomorrow") {
		return toISODate(addDays(now, 1));
	}
	if (trimmed === "yesterday") {
		return toISODate(addDays(now, -1));
	}
	if (trimmed === "next week") {
		return toISODate(addDays(now, 7));
	}

	// "next monday", "next friday", etc.
	const nextDayMatch = trimmed.match(
		/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/,
	);
	if (nextDayMatch) {
		return toISODate(nextWeekday(now, nextDayMatch[1]));
	}

	// "in N days"
	const inDaysMatch = trimmed.match(/^in\s+(\d+)\s+days?$/);
	if (inDaysMatch) {
		return toISODate(addDays(now, Number.parseInt(inDaysMatch[1], 10)));
	}

	// "Nd" shorthand (e.g. "3d", "30d")
	const shortDays = trimmed.match(/^(\d+)d$/);
	if (shortDays) {
		return toISODate(addDays(now, Number.parseInt(shortDays[1], 10)));
	}

	throw new Error(`Cannot parse date: "${input}". Use YYYY-MM-DD, "tomorrow", "in 3 days", etc.`);
}

/**
 * Parse a duration string like "30d" into a number of days.
 */
export function parseDays(input: string): number {
	const match = input.trim().match(/^(\d+)d$/);
	if (!match) {
		throw new Error(`Cannot parse duration: "${input}". Use format like "30d".`);
	}
	return Number.parseInt(match[1], 10);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function toISODate(date: Date): string {
	return date.toISOString().split("T")[0];
}

const WEEKDAYS: Record<string, number> = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

function nextWeekday(from: Date, dayName: string): Date {
	const target = WEEKDAYS[dayName];
	const current = from.getDay();
	let daysAhead = target - current;
	if (daysAhead <= 0) daysAhead += 7;
	return addDays(from, daysAhead);
}
