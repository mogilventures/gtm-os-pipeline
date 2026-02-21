import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("audit", () => {
	let tmpDir: string;
	let dbPath: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
		dbFlag = `--db ${dbPath}`;
		runPipeline(`init ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("logs human commands and shows them via audit --json", () => {
		runPipeline(`contact:add "Alice Test" ${dbFlag}`);
		const out = JSON.parse(runPipeline(`audit --json ${dbFlag}`));
		// init and contact:add should both be logged
		const commands = out.map((e: any) => e.command);
		expect(commands).toContain("contact:add");
		expect(commands).toContain("init");
		for (const entry of out) {
			expect(entry.actor).toBe("human");
			expect(entry.result).toBe("success");
			expect(entry.duration_ms).toBeTypeOf("number");
		}
	});

	it("audit command itself is NOT logged (no infinite loop)", () => {
		runPipeline(`contact:add "Bob Test" ${dbFlag}`);
		runPipeline(`audit ${dbFlag}`);
		runPipeline(`audit ${dbFlag}`);
		const out = JSON.parse(runPipeline(`audit --json ${dbFlag}`));
		const auditEntries = out.filter((e: any) => e.command === "audit");
		expect(auditEntries).toHaveLength(0);
	});

	it("filters by --actor", () => {
		runPipeline(`contact:add "Charlie Test" ${dbFlag}`);
		const out = JSON.parse(
			runPipeline(`audit --actor human --json ${dbFlag}`),
		);
		expect(out.length).toBeGreaterThan(0);
		for (const entry of out) {
			expect(entry.actor).toContain("human");
		}
	});

	it("filters by --command substring", () => {
		runPipeline(`contact:add "Diana Test" ${dbFlag}`);
		const out = JSON.parse(
			runPipeline(`audit --command contact:add --json ${dbFlag}`),
		);
		expect(out.length).toBeGreaterThan(0);
		for (const entry of out) {
			expect(entry.command).toContain("contact:add");
		}
	});

	it("respects --last limit", () => {
		runPipeline(`contact:add "Eve Test" ${dbFlag}`);
		runPipeline(`contact:add "Frank Test" ${dbFlag}`);
		runPipeline(`contact:add "Grace Test" ${dbFlag}`);
		const out = JSON.parse(runPipeline(`audit --last 2 --json ${dbFlag}`));
		expect(out).toHaveLength(2);
	});

	it("logs error commands with result=error", () => {
		try {
			runPipeline(`contact:rm nonexistent-contact-xyz ${dbFlag}`);
		} catch {
			// expected to fail
		}
		const out = JSON.parse(runPipeline(`audit --json ${dbFlag}`));
		const errorEntries = out.filter((e: any) => e.result === "error");
		expect(errorEntries.length).toBeGreaterThan(0);
		expect(errorEntries[0].error).toBeTruthy();
	});

	it("auto-prunes to 500 rows", () => {
		// Insert 510 rows directly via sqlite (bypassing the service counter)
		const sqlite = new Database(dbPath);
		const stmt = sqlite.prepare(
			"INSERT INTO audit_log (actor, command, result, created_at) VALUES (?, ?, ?, datetime('now'))",
		);
		for (let i = 0; i < 510; i++) {
			stmt.run("human", `synthetic:${i}`, "success");
		}
		sqlite.close();

		// This CLI command writes an audit entry, sees count > 500, and prunes
		// (init was already logged, so total will be 510 + init + contact:add > 500)
		runPipeline(`contact:add "Prune Test" ${dbFlag}`);

		const sqlite2 = new Database(dbPath);
		const count = sqlite2
			.prepare("SELECT COUNT(*) as cnt FROM audit_log")
			.get() as { cnt: number };
		sqlite2.close();
		// After pruning, should be at most 500
		expect(count.cnt).toBeLessThanOrEqual(500);
	});
});
