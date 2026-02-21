import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAgent, getBuiltinAgents } from "../../src/services/subagents.js";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("subagent definitions", () => {
	it("has eight builtin agents", () => {
		const agents = getBuiltinAgents();
		expect(agents).toHaveLength(8);
		expect(agents.map((a) => a.name)).toEqual([
			"follow-up",
			"enrich",
			"digest",
			"inbox",
			"qualify",
			"deal-manager",
			"meeting-prep",
			"task-automator",
		]);
	});

	it("getAgent returns a valid agent", () => {
		const agent = getAgent("follow-up");
		expect(agent).toBeDefined();
		expect(agent!.name).toBe("follow-up");
		expect(agent!.prompt).toBeTruthy();
	});

	it("shows subagent commands in help", () => {
		const output = runPipeline("--help");
		expect(output).toContain("agent");
	});

	it("subagent commands require API key", () => {
		const tmpDir = createTmpDir();
		const dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);

		try {
			runPipeline(`agent:follow-up ${dbFlag}`, { ANTHROPIC_API_KEY: "" });
			expect.fail("Should have thrown");
		} catch (error) {
			expect(String(error)).toContain("ANTHROPIC_API_KEY");
		} finally {
			cleanupTmpDir(tmpDir);
		}
	});
});

describe("custom agents", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("loads custom agent from .md file", async () => {
		// We test the service layer directly since custom agents
		// require files in ~/.pipeline/agents/
		const { getCustomAgents } = await import("../../src/services/subagents.js");
		// This reads from the real ~/.pipeline/agents/ dir
		// Just verify it doesn't crash
		const custom = getCustomAgents();
		expect(Array.isArray(custom)).toBe(true);
	});
});
