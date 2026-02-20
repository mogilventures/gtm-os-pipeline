import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("timeline command", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("shows no activity with empty DB", () => {
		const output = runPipeline(`timeline ${dbFlag}`);
		expect(output).toContain("No activity found");
	});

	it("shows interactions in timeline", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`,
		);
		runPipeline(
			`log:email jane --direction outbound --subject "Proposal" --body "See attached" ${dbFlag}`,
		);
		const output = runPipeline(`timeline ${dbFlag}`);
		expect(output).toContain("Activity Timeline");
		expect(output).toContain("interaction");
		expect(output).toContain("Jane Smith");
	});

	it("filters by type", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`,
		);
		runPipeline(
			`log:email jane --direction outbound --subject "Hello" --body "Hi" ${dbFlag}`,
		);
		runPipeline(
			`deal:add "Test Deal" --contact jane --value 5000 ${dbFlag}`,
		);

		const interactionsOnly = runPipeline(
			`timeline --type interaction ${dbFlag}`,
		);
		expect(interactionsOnly).toContain("interaction");
		expect(interactionsOnly).not.toContain("deal_created");

		const dealsOnly = runPipeline(
			`timeline --type deal_created ${dbFlag}`,
		);
		expect(dealsOnly).toContain("deal_created");
	});

	it("filters by last-days", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`,
		);
		runPipeline(
			`log:email jane --direction outbound --subject "Recent" --body "test" ${dbFlag}`,
		);
		// With last-days 0 should show no events
		const output = runPipeline(`timeline --last-days 0 ${dbFlag}`);
		expect(output).toContain("No activity found");
	});

	it("sorts events newest first", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`,
		);
		runPipeline(
			`deal:add "Deal A" --contact jane --value 1000 ${dbFlag}`,
		);
		runPipeline(
			`deal:add "Deal B" --contact jane --value 2000 ${dbFlag}`,
		);
		const output = runPipeline(`timeline --json ${dbFlag}`);
		const events = JSON.parse(output);
		expect(events.length).toBeGreaterThan(0);
		// Verify sorted descending
		for (let i = 1; i < events.length; i++) {
			expect(events[i - 1].timestamp >= events[i].timestamp).toBe(true);
		}
	});

	it("returns valid JSON array", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`,
		);
		runPipeline(
			`log:email jane --direction outbound --subject "Hello" --body "Hi" ${dbFlag}`,
		);
		const output = runPipeline(`timeline --json ${dbFlag}`);
		const events = JSON.parse(output);
		expect(Array.isArray(events)).toBe(true);
		expect(events[0]).toHaveProperty("timestamp");
		expect(events[0]).toHaveProperty("type");
		expect(events[0]).toHaveProperty("summary");
	});
});
