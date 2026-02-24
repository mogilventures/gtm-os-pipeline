import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("integrations", () => {
	let tmpDir: string;
	let dbFlag: string;
	let dbPath: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
		dbFlag = `--db ${dbPath}`;
		runPipeline(`init ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("creates connected_accounts and composio_triggers tables", () => {
		const sqlite = new Database(dbPath);
		const tables = sqlite
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
			)
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);
		expect(tableNames).toContain("connected_accounts");
		expect(tableNames).toContain("composio_triggers");
		sqlite.close();
	});

	it("integrations:list shows empty state", () => {
		const output = runPipeline(`integrations:list ${dbFlag}`);
		expect(output).toContain("No connected accounts");
	});

	it("integrations:list --json returns empty array for no accounts", () => {
		const output = runPipeline(`integrations:list --json ${dbFlag}`);
		// With no accounts, it shows the "No connected accounts" message, not JSON
		expect(output).toContain("No connected accounts");
	});

	it("integrations:list shows synthetic accounts", () => {
		const sqlite = new Database(dbPath);
		sqlite
			.prepare(
				`INSERT INTO connected_accounts (toolkit, composio_account_id, label, user_id, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				"gmail",
				"ca_test123",
				"Work Gmail",
				"test-user",
				"active",
				"2026-02-21T00:00:00.000Z",
				"2026-02-21T00:00:00.000Z",
			);
		sqlite.close();

		const output = runPipeline(`integrations:list --json ${dbFlag}`);
		const accounts = JSON.parse(output);
		expect(accounts).toHaveLength(1);
		expect(accounts[0].toolkit).toBe("gmail");
		expect(accounts[0].label).toBe("Work Gmail");
		expect(accounts[0].status).toBe("active");
	});

	it("integrations:list shows multiple accounts as table", () => {
		const sqlite = new Database(dbPath);
		const stmt = sqlite.prepare(
			`INSERT INTO connected_accounts (toolkit, composio_account_id, label, user_id, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);
		stmt.run(
			"gmail",
			"ca_1",
			"Work Gmail",
			"test-user",
			"active",
			"2026-02-21T00:00:00.000Z",
			"2026-02-21T00:00:00.000Z",
		);
		stmt.run(
			"slack",
			"ca_2",
			"Team Slack",
			"test-user",
			"active",
			"2026-02-21T00:00:00.000Z",
			"2026-02-21T00:00:00.000Z",
		);
		sqlite.close();

		const output = runPipeline(`integrations:list ${dbFlag}`);
		expect(output).toContain("gmail");
		expect(output).toContain("slack");
		expect(output).toContain("Work Gmail");
		expect(output).toContain("Team Slack");
	});

	it("integrations:disconnect removes synthetic account", () => {
		const sqlite = new Database(dbPath);
		sqlite
			.prepare(
				`INSERT INTO connected_accounts (toolkit, composio_account_id, label, user_id, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				"gmail",
				"ca_disconnect_test",
				"Test Gmail",
				"test-user",
				"active",
				"2026-02-21T00:00:00.000Z",
				"2026-02-21T00:00:00.000Z",
			);
		sqlite.close();

		// Disconnect will try to call Composio API (which will fail) but still removes locally
		const output = runPipeline(`integrations:disconnect 1 ${dbFlag}`);
		expect(output).toContain("Disconnected account 1");

		// Verify removal
		const listOutput = runPipeline(`integrations:list ${dbFlag}`);
		expect(listOutput).toContain("No connected accounts");
	});

	it("integrations:disconnect fails for nonexistent account", () => {
		expect(() =>
			runPipeline(`integrations:disconnect 999 ${dbFlag}`),
		).toThrow();
	});

	it("integrations:triggers:list shows empty state", () => {
		const output = runPipeline(`integrations:triggers:list ${dbFlag}`);
		expect(output).toContain("No triggers configured");
	});

	it("integrations:triggers:list shows synthetic triggers", () => {
		const sqlite = new Database(dbPath);
		sqlite
			.prepare(
				`INSERT INTO composio_triggers (trigger_id, toolkit, trigger_slug, enabled, created_at)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.run(
				"trig_test123",
				"gmail",
				"GMAIL_NEW_EMAIL",
				1,
				"2026-02-21T00:00:00.000Z",
			);
		sqlite.close();

		const output = runPipeline(`integrations:triggers:list --json ${dbFlag}`);
		const triggers = JSON.parse(output);
		expect(triggers).toHaveLength(1);
		expect(triggers[0].trigger_slug).toBe("GMAIL_NEW_EMAIL");
		expect(triggers[0].toolkit).toBe("gmail");
		expect(triggers[0].enabled).toBe(true);
	});

	it("integrations:triggers:remove removes synthetic trigger", () => {
		const sqlite = new Database(dbPath);
		sqlite
			.prepare(
				`INSERT INTO composio_triggers (trigger_id, toolkit, trigger_slug, enabled, created_at)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.run(
				"trig_remove_test",
				"slack",
				"SLACK_NEW_MESSAGE",
				1,
				"2026-02-21T00:00:00.000Z",
			);
		sqlite.close();

		const output = runPipeline(`integrations:triggers:remove 1 ${dbFlag}`);
		expect(output).toContain("Trigger 1 removed");

		const listOutput = runPipeline(`integrations:triggers:list ${dbFlag}`);
		expect(listOutput).toContain("No triggers configured");
	});

	it("integrations:triggers:remove fails for nonexistent trigger", () => {
		expect(() =>
			runPipeline(`integrations:triggers:remove 999 ${dbFlag}`),
		).toThrow();
	});
});
