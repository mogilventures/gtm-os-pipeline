import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

function insertPendingAction(
	dbPath: string,
	actionType: string,
	payload: Record<string, unknown>,
	reasoning: string,
): number {
	const db = new Database(dbPath);
	const result = db
		.prepare(
			"INSERT INTO pending_actions (action_type, payload, reasoning, status) VALUES (?, ?, ?, 'pending')",
		)
		.run(actionType, JSON.stringify(payload), reasoning);
	db.close();
	return Number(result.lastInsertRowid);
}

describe("approval workflow", () => {
	let tmpDir: string;
	let dbFlag: string;
	let dbPath: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
		dbFlag = `--db ${dbPath}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`,
		);
		runPipeline(
			`deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal ${dbFlag}`,
		);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("shows no pending actions when empty", () => {
		const output = runPipeline(`approve --list ${dbFlag}`);
		expect(output).toContain("No pending actions");
	});

	it("lists pending actions", () => {
		insertPendingAction(
			dbPath,
			"create_task",
			{ title: "Follow up with Jane" },
			"Jane hasn't been contacted recently",
		);

		const output = runPipeline(`approve --list ${dbFlag}`);
		expect(output).toContain("create_task");
		expect(output).toContain("Jane hasn't been contacted recently");
	});

	it("lists pending actions as JSON", () => {
		insertPendingAction(
			dbPath,
			"log_note",
			{ body: "Test note" },
			"Agent observation",
		);

		const output = runPipeline(`approve --list --json ${dbFlag}`);
		const actions = JSON.parse(output);
		expect(actions).toHaveLength(1);
		expect(actions[0].action_type).toBe("log_note");
	});

	it("approves all pending actions", () => {
		insertPendingAction(
			dbPath,
			"create_task",
			{ title: "Follow up with Jane" },
			"Stale contact",
		);
		insertPendingAction(
			dbPath,
			"log_note",
			{ body: "Agent note about deal" },
			"Deal update",
		);

		const output = runPipeline(`approve --all ${dbFlag}`);
		expect(output).toContain("Approved");

		// Verify actions were executed - no more pending
		const listOutput = runPipeline(`approve --list ${dbFlag}`);
		expect(listOutput).toContain("No pending actions");

		// Verify task was created
		const taskOutput = runPipeline(`task:list --json ${dbFlag}`);
		const tasks = JSON.parse(taskOutput);
		expect(
			tasks.some((t: { title: string }) => t.title === "Follow up with Jane"),
		).toBe(true);
	});

	it("rejects a specific action", () => {
		const actionId = insertPendingAction(
			dbPath,
			"send_email",
			{ to: "jane@acme.co", subject: "Hello" },
			"Time to reach out",
		);

		const output = runPipeline(`approve --reject ${actionId} ${dbFlag}`);
		expect(output).toContain("Rejected");

		// Verify it's no longer pending
		const listOutput = runPipeline(`approve --list ${dbFlag}`);
		expect(listOutput).toContain("No pending actions");
	});

	it("approve creates a task from create_task action", () => {
		insertPendingAction(
			dbPath,
			"create_task",
			{ title: "Schedule demo call" },
			"Deal progressing",
		);

		runPipeline(`approve --all ${dbFlag}`);

		const taskOutput = runPipeline(`task:list --json ${dbFlag}`);
		const tasks = JSON.parse(taskOutput);
		expect(
			tasks.some((t: { title: string }) => t.title === "Schedule demo call"),
		).toBe(true);
	});

	it("approve logs a note from log_note action", () => {
		insertPendingAction(
			dbPath,
			"log_note",
			{ body: "Agent noticed deal stalling" },
			"No activity for 14 days",
		);

		const output = runPipeline(`approve --all ${dbFlag}`);
		expect(output).toContain("Logged note");
	});

	it("approve send_email logs interaction as draft when sending fails", () => {
		insertPendingAction(
			dbPath,
			"send_email",
			{
				to: "jane@acme.co",
				subject: "Follow up",
				body: "Hi Jane",
				contact_id: 1,
			},
			"Stale contact",
		);

		// Use HOME=tmpDir so no global email config leaks in; sending will fail
		const output = runPipeline(`approve --all ${dbFlag}`, { HOME: tmpDir });
		expect(output).toContain("Email sending failed");
		expect(output).toContain("logged as draft");
	});

	it("approve moves deal stage from update_stage action", () => {
		// Get deal ID
		const dealOutput = runPipeline(`deal:list --json ${dbFlag}`);
		const deals = JSON.parse(dealOutput);
		const dealId = deals[0].id;

		insertPendingAction(
			dbPath,
			"update_stage",
			{ deal_id: dealId, stage: "negotiation" },
			"Deal is ready to negotiate",
		);

		runPipeline(`approve --all ${dbFlag}`);

		const updatedOutput = runPipeline(`deal:list --json ${dbFlag}`);
		const updatedDeals = JSON.parse(updatedOutput);
		expect(updatedDeals[0].stage).toBe("negotiation");
	});
});
