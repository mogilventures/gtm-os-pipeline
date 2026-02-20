import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("deal commands", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("adds a deal", () => {
		const output = runPipeline(
			`deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal ${dbFlag}`,
		);
		expect(output).toContain("Added deal: Acme Consulting");
		expect(output).toContain("proposal");
	});

	it("lists deals", () => {
		runPipeline(`deal:add "Acme Consulting" --value 15000 --stage proposal ${dbFlag}`);
		runPipeline(`deal:add "Startup Deal" --value 5000 ${dbFlag}`);
		const output = runPipeline(`deal:list ${dbFlag}`);
		expect(output).toContain("Acme Consulting");
		expect(output).toContain("Startup Deal");
	});

	it("moves a deal", () => {
		runPipeline(`deal:add "Acme Consulting" --stage lead ${dbFlag}`);
		runPipeline(`deal:move acme proposal ${dbFlag}`);
		const output = runPipeline(`deal:list --json ${dbFlag}`);
		const deals = JSON.parse(output);
		expect(deals[0].stage).toBe("proposal");
	});

	it("closes a deal as won", () => {
		runPipeline(`deal:add "Acme Consulting" --stage proposal ${dbFlag}`);
		runPipeline(`deal:close acme --won --reason "Great fit" ${dbFlag}`);
		const output = runPipeline(`deal:list --json ${dbFlag}`);
		const deals = JSON.parse(output);
		expect(deals[0].stage).toBe("closed_won");
	});

	it("closes a deal as lost", () => {
		runPipeline(`deal:add "Acme Consulting" --stage proposal ${dbFlag}`);
		runPipeline(`deal:close acme --lost --reason "Budget cut" ${dbFlag}`);
		const output = runPipeline(`deal:list --json ${dbFlag}`);
		const deals = JSON.parse(output);
		expect(deals[0].stage).toBe("closed_lost");
	});

	it("shows pipeline view", () => {
		runPipeline(`deal:add "Acme Consulting" --value 15000 --stage proposal ${dbFlag}`);
		runPipeline(`deal:add "Startup Deal" --value 5000 --stage lead ${dbFlag}`);
		const output = runPipeline(`deal:pipeline ${dbFlag}`);
		expect(output).toContain("proposal");
		expect(output).toContain("lead");
	});

	it("validates stages", () => {
		try {
			runPipeline(`deal:add "Bad Deal" --stage nonexistent ${dbFlag}`);
			expect.fail("Should have thrown");
		} catch {
			// expected
		}
	});

	it("adds a deal note", () => {
		runPipeline(`deal:add "Acme Consulting" --stage proposal ${dbFlag}`);
		const output = runPipeline(`deal:note acme "Sent revised proposal" ${dbFlag}`);
		expect(output).toContain("Note added");
	});

	it("full deal lifecycle: add → move → close", () => {
		runPipeline(`deal:add "Lifecycle Deal" --value 10000 ${dbFlag}`);
		runPipeline(`deal:move lifecycle qualified ${dbFlag}`);
		runPipeline(`deal:move lifecycle proposal ${dbFlag}`);
		runPipeline(`deal:close lifecycle --won ${dbFlag}`);
		const output = runPipeline(`deal:list --json ${dbFlag}`);
		const deals = JSON.parse(output);
		const deal = deals.find((d: { title: string }) => d.title === "Lifecycle Deal");
		expect(deal.stage).toBe("closed_won");
	});
});
