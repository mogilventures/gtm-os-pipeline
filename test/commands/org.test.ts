import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("organization commands", () => {
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

	it("adds an organization", () => {
		const output = runPipeline(
			`org:add "Acme Corp" --domain acme.co --industry Tech ${dbFlag}`,
		);
		expect(output).toContain("Added organization: Acme Corp");
	});

	it("lists organizations", () => {
		runPipeline(`org:add "Acme Corp" --industry Tech ${dbFlag}`);
		runPipeline(`org:add "Startup Inc" --industry SaaS ${dbFlag}`);
		const output = runPipeline(`org:list ${dbFlag}`);
		expect(output).toContain("Acme Corp");
		expect(output).toContain("Startup Inc");
	});

	it("shows organization details", () => {
		runPipeline(`org:add "Acme Corp" --domain acme.co --industry Tech ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --org "Acme Corp" --role CTO ${dbFlag}`);
		const output = runPipeline(`org:show acme ${dbFlag}`);
		expect(output).toContain("Acme Corp");
		expect(output).toContain("Jane Smith");
	});

	it("edits an organization", () => {
		runPipeline(`org:add "Acme Corp" ${dbFlag}`);
		runPipeline(`org:edit acme --industry "Enterprise SaaS" ${dbFlag}`);
		const output = runPipeline(`org:show acme --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data.industry).toBe("Enterprise SaaS");
	});

	it("lists contacts at org", () => {
		runPipeline(`org:add "Acme Corp" ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --org "Acme Corp" --role CTO ${dbFlag}`);
		runPipeline(`contact:add "Bob Lee" --org "Acme Corp" --role VP ${dbFlag}`);
		const output = runPipeline(`org:contacts acme ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("Bob Lee");
	});
});
