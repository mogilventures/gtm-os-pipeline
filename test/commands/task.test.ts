import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("task commands", () => {
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

	it("adds a task", () => {
		const output = runPipeline(
			`task:add "Follow up with Jane" --contact jane --due tomorrow ${dbFlag}`,
		);
		expect(output).toContain("Added task: Follow up with Jane");
		expect(output).toContain("due:");
	});

	it("lists tasks", () => {
		runPipeline(`task:add "Task 1" --due tomorrow ${dbFlag}`);
		runPipeline(`task:add "Task 2" ${dbFlag}`);
		const output = runPipeline(`task:list ${dbFlag}`);
		expect(output).toContain("Task 1");
		expect(output).toContain("Task 2");
	});

	it("marks a task as done", () => {
		runPipeline(`task:add "Task to complete" ${dbFlag}`);
		const output = runPipeline(`task:done "Task to complete" ${dbFlag}`);
		expect(output).toContain("Completed");

		// Should not appear in active task list
		const list = runPipeline(`task:list ${dbFlag}`);
		expect(list).not.toContain("Task to complete");
	});

	it("parses due dates correctly", () => {
		runPipeline(`task:add "Future task" --due 2026-03-01 ${dbFlag}`);
		const output = runPipeline(`task:list --json ${dbFlag}`);
		const tasks = JSON.parse(output);
		expect(tasks[0].due).toBe("2026-03-01");
	});

	it("filters overdue tasks", () => {
		// Add a task with a past due date
		runPipeline(`task:add "Overdue task" --due 2020-01-01 ${dbFlag}`);
		runPipeline(`task:add "Future task" --due 2099-12-31 ${dbFlag}`);
		const output = runPipeline(`task:list --overdue --json ${dbFlag}`);
		const tasks = JSON.parse(output);
		expect(tasks).toHaveLength(1);
		expect(tasks[0].title).toBe("Overdue task");
	});
});
