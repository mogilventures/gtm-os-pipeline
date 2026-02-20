import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("interaction logging", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("logs an email", () => {
		const output = runPipeline(
			`log:email jane --direction outbound --subject "Proposal sent" ${dbFlag}`,
		);
		expect(output).toContain("Logged email with Jane Smith");
	});

	it("logs a call", () => {
		const output = runPipeline(
			`log:call jane --direction inbound --body "Quick sync call" ${dbFlag}`,
		);
		expect(output).toContain("Logged call with Jane Smith");
	});

	it("logs a meeting", () => {
		const output = runPipeline(
			`log:meeting jane --body "Product demo" ${dbFlag}`,
		);
		expect(output).toContain("Logged meeting with Jane Smith");
	});

	it("lists interactions", () => {
		runPipeline(`log:email jane --subject "Hello" ${dbFlag}`);
		runPipeline(`log:call jane --body "Call notes" ${dbFlag}`);
		const output = runPipeline(`log:list ${dbFlag}`);
		expect(output).toContain("email");
		expect(output).toContain("call");
	});

	it("filters interactions by type", () => {
		runPipeline(`log:email jane --subject "Hello" ${dbFlag}`);
		runPipeline(`log:call jane --body "Call notes" ${dbFlag}`);
		const output = runPipeline(`log:list --type email --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data.every((i: { type: string }) => i.type === "email")).toBe(true);
	});

	it("updates contact timestamp on new interaction", () => {
		const before = JSON.parse(runPipeline(`contact:show jane --json ${dbFlag}`));
		// Small delay to ensure timestamp differs
		runPipeline(`log:email jane --subject "Follow up" ${dbFlag}`);
		const after = JSON.parse(runPipeline(`contact:show jane --json ${dbFlag}`));
		expect(after.updated_at >= before.updated_at).toBe(true);
	});
});
