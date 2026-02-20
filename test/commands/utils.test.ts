import { describe, expect, it } from "vitest";
import { parseDate, parseDays } from "../../src/utils/dates.js";
import { fuzzySearch } from "../../src/utils/fuzzy.js";
import { formatJson, formatTable } from "../../src/utils/output.js";

describe("date parsing", () => {
	it("parses ISO dates", () => {
		expect(parseDate("2026-02-25")).toBe("2026-02-25");
	});

	it("parses 'today'", () => {
		const today = new Date().toISOString().split("T")[0];
		expect(parseDate("today")).toBe(today);
	});

	it("parses 'tomorrow'", () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		expect(parseDate("tomorrow")).toBe(tomorrow.toISOString().split("T")[0]);
	});

	it("parses 'in 3 days'", () => {
		const future = new Date();
		future.setDate(future.getDate() + 3);
		expect(parseDate("in 3 days")).toBe(future.toISOString().split("T")[0]);
	});

	it("parses '7d' shorthand", () => {
		const future = new Date();
		future.setDate(future.getDate() + 7);
		expect(parseDate("7d")).toBe(future.toISOString().split("T")[0]);
	});

	it("parses 'next week'", () => {
		const future = new Date();
		future.setDate(future.getDate() + 7);
		expect(parseDate("next week")).toBe(future.toISOString().split("T")[0]);
	});

	it("throws on invalid date", () => {
		expect(() => parseDate("gibberish")).toThrow();
	});

	it("parseDays handles valid input", () => {
		expect(parseDays("30d")).toBe(30);
	});

	it("parseDays throws on invalid input", () => {
		expect(() => parseDays("abc")).toThrow();
	});
});

describe("fuzzy search", () => {
	const items = [
		{ id: 1, name: "Jane Smith" },
		{ id: 2, name: "Bob Lee" },
		{ id: 3, name: "Janet Johnson" },
	];

	it("finds exact matches", () => {
		const results = fuzzySearch(items, "Jane Smith");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.name).toBe("Jane Smith");
	});

	it("finds fuzzy matches", () => {
		const results = fuzzySearch(items, "jane");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].item.name).toContain("Jane");
	});

	it("returns empty for no matches", () => {
		const results = fuzzySearch(items, "zzzzzzzzzzzzz");
		expect(results).toHaveLength(0);
	});
});

describe("output formatting", () => {
	it("formatJson produces valid JSON", () => {
		const result = formatJson({ name: "Jane" });
		expect(JSON.parse(result)).toEqual({ name: "Jane" });
	});

	it("formatTable renders a table", () => {
		const result = formatTable(["Name", "Role"], [["Jane", "CTO"]]);
		expect(result).toContain("Jane");
		expect(result).toContain("CTO");
	});
});
