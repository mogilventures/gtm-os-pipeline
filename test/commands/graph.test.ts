import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("relationship graph", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`);
		runPipeline(`contact:add "Bob Lee" --email bob@startup.io ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("links two entities", () => {
		const output = runPipeline(`link jane --works-at "Acme Corp" ${dbFlag}`);
		expect(output).toContain("Linked");
		expect(output).toContain("works_at");
	});

	it("shows related entities", () => {
		runPipeline(`deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal ${dbFlag}`);
		runPipeline(`log:email jane --subject "Proposal sent" ${dbFlag}`);
		runPipeline(`task:add "Follow up" --contact jane --due tomorrow ${dbFlag}`);
		runPipeline(`link jane --works-at "Acme Corp" ${dbFlag}`);

		const output = runPipeline(`related jane ${dbFlag}`);
		expect(output).toContain("Contacts");
		expect(output).toContain("Organizations");
		expect(output).toContain("Acme Corp");
		expect(output).toContain("Deals");
		expect(output).toContain("Acme Consulting");
		expect(output).toContain("Interactions");
		expect(output).toContain("Tasks");
		expect(output).toContain("Edges");
		expect(output).toContain("works_at");
	});

	it("unlinks entities", () => {
		runPipeline(`link jane --works-at "Acme Corp" ${dbFlag}`);
		runPipeline(`unlink jane --relation works_at --target "Acme Corp" ${dbFlag}`);
		const output = runPipeline(`related jane --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data.related.edges).toHaveLength(0);
	});

	it("supports custom relations", () => {
		const output = runPipeline(
			`link jane --relation advisor_to "Acme Corp" ${dbFlag}`,
		);
		expect(output).toContain("advisor_to");
	});

	it("shows bidirectional traversal", () => {
		runPipeline(`link jane --works-at "Acme Corp" ${dbFlag}`);
		// When we look at "Acme Corp" related, we should see the edge from Jane
		const output = runPipeline(`related "Acme Corp" ${dbFlag}`);
		expect(output).toContain("Edges");
	});
});
