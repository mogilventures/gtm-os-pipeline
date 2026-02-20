import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("agent command", () => {
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

	it("shows error when ANTHROPIC_API_KEY is missing", () => {
		try {
			runPipeline(`agent "test" ${dbFlag}`, { ANTHROPIC_API_KEY: "" });
			expect.fail("Should have thrown");
		} catch (error) {
			expect(String(error)).toContain("ANTHROPIC_API_KEY");
		}
	});

	it("shows agent command in help", () => {
		const output = runPipeline("--help");
		expect(output).toContain("agent");
	});
});
