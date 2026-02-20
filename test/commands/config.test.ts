import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("init, config, and status", () => {
	let tmpDir: string;
	let dbPath: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("pipeline init creates DB", () => {
		const output = runPipeline(`init --db ${dbPath}`);
		expect(output).toContain("Created database");
		expect(existsSync(dbPath)).toBe(true);
	});

	it("pipeline init is idempotent", () => {
		runPipeline(`init --db ${dbPath}`);
		const output = runPipeline(`init --db ${dbPath}`);
		expect(output).toContain("already exists");
	});

	it("pipeline status shows table counts", () => {
		runPipeline(`init --db ${dbPath}`);
		const output = runPipeline(`status --db ${dbPath}`);
		expect(output).toContain("Pipeline CRM Status");
		expect(output).toContain("contacts");
		expect(output).toContain("deals");
		expect(output).toContain("0");
	});

	it("pipeline status shows not initialized when no DB", () => {
		const output = runPipeline(`status --db ${join(tmpDir, "nonexistent.db")}`);
		expect(output).toContain("not initialized");
	});

	it("config set and get round-trip", () => {
		runPipeline("config:set pipeline.currency EUR");
		const output = runPipeline("config:get pipeline.currency");
		expect(output).toBe("EUR");
	});

	it("config get returns default values", () => {
		const output = runPipeline("config:get agent.model");
		expect(output).toContain("claude");
	});
});
