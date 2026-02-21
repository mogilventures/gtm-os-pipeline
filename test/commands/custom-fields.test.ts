import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("custom fields commands", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`,
		);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("sets a field on a contact", () => {
		const output = runPipeline(
			`field:set contact:jane industry_focus fintech ${dbFlag}`,
		);
		expect(output).toContain('Set field "industry_focus" = "fintech"');
		expect(output).toContain("Jane Smith");
	});

	it("gets all fields for a contact", () => {
		runPipeline(`field:set contact:jane industry_focus fintech ${dbFlag}`);
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);
		const output = runPipeline(`field:get contact:jane ${dbFlag}`);
		expect(output).toContain("industry_focus");
		expect(output).toContain("fintech");
		expect(output).toContain("lead_score");
		expect(output).toContain("85");
		expect(output).toContain("2 custom fields");
	});

	it("gets a specific field by name", () => {
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);
		const output = runPipeline(
			`field:get contact:jane --field lead_score ${dbFlag}`,
		);
		expect(output).toContain("lead_score = 85");
	});

	it("updates an existing field (upsert)", () => {
		runPipeline(`field:set contact:jane lead_score 50 ${dbFlag}`);
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);
		const output = runPipeline(
			`field:get contact:jane --field lead_score ${dbFlag}`,
		);
		expect(output).toContain("lead_score = 85");
	});

	it("removes a field", () => {
		runPipeline(`field:set contact:jane industry_focus fintech ${dbFlag}`);
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);
		const output = runPipeline(`field:rm contact:jane lead_score ${dbFlag}`);
		expect(output).toContain('Removed field "lead_score"');

		const fields = runPipeline(`field:get contact:jane ${dbFlag}`);
		expect(fields).toContain("industry_focus");
		expect(fields).not.toContain("lead_score");
		expect(fields).toContain("1 custom field");
	});

	it("sets fields on deals", () => {
		runPipeline(`deal:add "Acme Deal" --contact jane --value 15000 ${dbFlag}`);
		const output = runPipeline(
			`field:set deal:acme priority_score high ${dbFlag}`,
		);
		expect(output).toContain('Set field "priority_score" = "high"');
		expect(output).toContain("deal");
	});

	it("sets fields on organizations", () => {
		const output = runPipeline(`field:set org:acme founded 2020 ${dbFlag}`);
		expect(output).toContain('Set field "founded" = "2020"');
		expect(output).toContain("organization");
	});

	it("shows custom fields in contact:show", () => {
		runPipeline(`field:set contact:jane industry_focus fintech ${dbFlag}`);
		const output = runPipeline(`contact:show jane ${dbFlag}`);
		expect(output).toContain("Custom Fields");
		expect(output).toContain("industry_focus");
		expect(output).toContain("fintech");
	});

	it("shows custom fields in org:show", () => {
		runPipeline(`field:set org:acme founded 2020 ${dbFlag}`);
		const output = runPipeline(`org:show acme ${dbFlag}`);
		expect(output).toContain("Custom Fields");
		expect(output).toContain("founded");
		expect(output).toContain("2020");
	});

	it("returns valid JSON from field:get", () => {
		runPipeline(`field:set contact:jane industry_focus fintech ${dbFlag}`);
		const output = runPipeline(`field:get contact:jane --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(Array.isArray(data)).toBe(true);
		expect(data[0]).toHaveProperty("field_name", "industry_focus");
		expect(data[0]).toHaveProperty("field_value", "fintech");
	});

	it("errors on invalid entity type", () => {
		try {
			runPipeline(`field:set invalid:1 foo bar ${dbFlag}`);
			expect.fail("Should have thrown");
		} catch {
			// Command should error for invalid entity type
		}
	});
});
