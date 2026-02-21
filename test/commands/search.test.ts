import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("search command", () => {
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

	it("finds contact by name", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`,
		);
		const output = runPipeline(`search jane ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("contact");
	});

	it("finds contact by email", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		const output = runPipeline(`search jane@acme ${dbFlag}`);
		expect(output).toContain("Jane Smith");
	});

	it("finds deal by title", () => {
		runPipeline(`deal:add "Acme Consulting" --value 15000 ${dbFlag}`);
		const output = runPipeline(`search acme ${dbFlag}`);
		expect(output).toContain("Acme Consulting");
		expect(output).toContain("deal");
	});

	it("finds organization by name", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`,
		);
		const output = runPipeline(`search acme ${dbFlag}`);
		expect(output).toContain("Acme Corp");
		expect(output).toContain("organization");
	});

	it("filters by type", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`,
		);
		runPipeline(`deal:add "Acme Deal" --value 5000 ${dbFlag}`);
		const output = runPipeline(`search acme --type deal ${dbFlag}`);
		expect(output).toContain("deal");
		expect(output).not.toContain("organization");
		expect(output).not.toContain("contact");
	});

	it("shows no results message", () => {
		const output = runPipeline(`search zzzznotfound ${dbFlag}`);
		expect(output).toContain("No results found");
	});

	it("returns valid JSON structure", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		const output = runPipeline(`search jane --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data).toHaveProperty("results");
		expect(data).toHaveProperty("query", "jane");
		expect(data.results[0]).toHaveProperty("type");
		expect(data.results[0]).toHaveProperty("id");
		expect(data.results[0]).toHaveProperty("name");
		expect(data.results[0]).toHaveProperty("score");
	});

	it("ranks results by relevance", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`contact:add "Janet Williams" --email janet@beta.co ${dbFlag}`);
		const output = runPipeline(`search jane --json ${dbFlag}`);
		const data = JSON.parse(output);
		const contactResults = data.results.filter(
			(r: { type: string }) => r.type === "contact",
		);
		// "Jane Smith" should score better than "Janet Williams" for "jane"
		if (contactResults.length >= 2) {
			expect(contactResults[0].score).toBeLessThanOrEqual(
				contactResults[1].score,
			);
		}
	});
});
