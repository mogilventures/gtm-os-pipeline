import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("email commands", () => {
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

	it("email:send fails without email configured", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);
		expect(() =>
			runPipeline(`email:send jane --subject "Test" --body "Hello" ${dbFlag}`),
		).toThrow(/[Ee]mail not configured/);
	});

	it("email:send --help shows description", () => {
		const output = runPipeline("email:send --help");
		expect(output).toContain("Send an email to a contact");
	});

	it("email:inbox shows empty state", () => {
		const output = runPipeline(`email:inbox ${dbFlag}`);
		expect(output).toContain("No inbound emails");
	});

	it("email:inbox shows synthetic inbound emails", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);

		// Insert a synthetic inbound email directly
		const db = new Database(dbPath);
		db.prepare(
			`INSERT INTO interactions (contact_id, type, direction, subject, body, from_address, message_id, occurred_at, created_at)
			 VALUES (1, 'email', 'inbound', 'Hello from Jane', 'Hi there!', 'jane@test.co', 'msg_001', datetime('now'), datetime('now'))`,
		).run();
		db.close();

		const output = runPipeline(`email:inbox ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("Hello from Jane");
	});

	it("email:inbox --json returns JSON array", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);

		const db = new Database(dbPath);
		db.prepare(
			`INSERT INTO interactions (contact_id, type, direction, subject, body, from_address, message_id, occurred_at, created_at)
			 VALUES (1, 'email', 'inbound', 'Test Subject', 'Body text', 'jane@test.co', 'msg_002', datetime('now'), datetime('now'))`,
		).run();
		db.close();

		const output = runPipeline(`email:inbox --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data).toHaveLength(1);
		expect(data[0].direction).toBe("inbound");
		expect(data[0].subject).toBe("Test Subject");
	});

	it("email:thread shows conversation for a contact", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);

		const db = new Database(dbPath);
		db.prepare(
			`INSERT INTO interactions (contact_id, type, direction, subject, body, from_address, message_id, occurred_at, created_at)
			 VALUES (1, 'email', 'inbound', 'Hello', 'Hi there', 'jane@test.co', 'msg_003', datetime('now', '-1 hour'), datetime('now'))`,
		).run();
		db.prepare(
			`INSERT INTO interactions (contact_id, type, direction, subject, body, occurred_at, created_at)
			 VALUES (1, 'email', 'outbound', 'Re: Hello', 'Thanks Jane!', datetime('now'), datetime('now'))`,
		).run();
		db.close();

		const output = runPipeline(`email:thread jane ${dbFlag}`);
		expect(output).toContain("Jane Smith");
		expect(output).toContain("IN");
		expect(output).toContain("OUT");
		expect(output).toContain("Hello");
	});

	it("email:thread shows empty state for no emails", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);
		const output = runPipeline(`email:thread jane ${dbFlag}`);
		expect(output).toContain("No email history");
	});

	it("email:sync --help shows description", () => {
		const output = runPipeline("email:sync --help");
		expect(output).toContain("Sync inbound emails from Resend");
	});

	it("unique index prevents duplicate message_id inserts", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@test.co ${dbFlag}`);

		const db = new Database(dbPath);
		db.prepare(
			`INSERT INTO interactions (contact_id, type, direction, subject, message_id, occurred_at, created_at)
			 VALUES (1, 'email', 'inbound', 'First', 'msg_dup', datetime('now'), datetime('now'))`,
		).run();

		expect(() =>
			db
				.prepare(
					`INSERT INTO interactions (contact_id, type, direction, subject, message_id, occurred_at, created_at)
				 VALUES (1, 'email', 'inbound', 'Duplicate', 'msg_dup', datetime('now'), datetime('now'))`,
				)
				.run(),
		).toThrow();

		db.close();
	});
});
