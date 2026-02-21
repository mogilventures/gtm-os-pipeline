import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("contact commands", () => {
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

	it("adds a contact", () => {
		const output = runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`,
		);
		expect(output).toContain("Added contact: Jane Smith");
		expect(output).toContain("Acme Corp");
	});

	it("adds contact with tags", () => {
		const output = runPipeline(
			`contact:add "Bob Lee" --email bob@startup.io --tag investor --tag vip ${dbFlag}`,
		);
		expect(output).toContain("Added contact: Bob Lee");
	});

	it("lists contacts", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`contact:add "Bob Lee" --email bob@startup.io ${dbFlag}`);
		const output = runPipeline(`contact:list ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("Bob Lee");
	});

	it("lists contacts as JSON", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		const output = runPipeline(`contact:list --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe("Jane Smith");
	});

	it("shows a contact", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`,
		);
		const output = runPipeline(`contact:show jane ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("Acme Corp");
		expect(output).toContain("CTO");
	});

	it("edits a contact", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`contact:edit jane --role CEO --warmth hot ${dbFlag}`);
		const output = runPipeline(`contact:show jane --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data.role).toBe("CEO");
		expect(data.warmth).toBe("hot");
	});

	it("tags a contact", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		const output = runPipeline(`contact:tag jane +investor +vip ${dbFlag}`);
		expect(output).toContain("investor");
		expect(output).toContain("vip");
	});

	it("removes a tag", () => {
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --tag investor ${dbFlag}`,
		);
		const output = runPipeline(`contact:tag jane ${dbFlag} -- -investor`);
		expect(output).not.toContain("investor");
	});

	it("removes a contact", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`contact:rm jane --confirm ${dbFlag}`);
		const output = runPipeline(`contact:list ${dbFlag}`);
		expect(output).toContain("No contacts found");
	});

	it("adds a note", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		const output = runPipeline(
			`contact:note jane "Great meeting today" ${dbFlag}`,
		);
		expect(output).toContain("Note added");
	});

	it("auto-creates person from email match", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		// Adding another contact with the same email should reuse the person
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "New Corp" ${dbFlag}`,
		);
		const output = runPipeline(`contact:list --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data).toHaveLength(2);
		expect(data[0].person_id).toBe(data[1].person_id);
	});

	it("auto-creates org when adding contact with --org", () => {
		runPipeline(`contact:add "Jane Smith" --org "Acme Corp" ${dbFlag}`);
		const output = runPipeline(`status ${dbFlag}`);
		expect(output).toContain("organizations");
	});

	it("filters contacts by tag", () => {
		runPipeline(`contact:add "Jane Smith" --tag investor ${dbFlag}`);
		runPipeline(`contact:add "Bob Lee" --tag founder ${dbFlag}`);
		const output = runPipeline(`contact:list --tag investor --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe("Jane Smith");
	});
});
