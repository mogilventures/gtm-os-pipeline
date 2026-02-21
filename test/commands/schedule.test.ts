import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDue } from "../../src/services/schedule.js";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("schedule management", () => {
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

	it("adds a schedule for a builtin agent", () => {
		const output = runPipeline(`schedule:add digest --every daily ${dbFlag}`);
		expect(output).toContain('Scheduled "digest" to run daily');

		const list = runPipeline(`schedule:list --json ${dbFlag}`);
		const schedules = JSON.parse(list);
		expect(schedules).toHaveLength(1);
		expect(schedules[0].agent_name).toBe("digest");
		expect(schedules[0].interval).toBe("daily");
	});

	it("rejects unknown agent name", () => {
		expect(() =>
			runPipeline(`schedule:add nonexistent --every daily ${dbFlag}`),
		).toThrow();
	});

	it("rejects invalid interval", () => {
		expect(() =>
			runPipeline(`schedule:add digest --every biweekly ${dbFlag}`),
		).toThrow();
	});

	it("prevents duplicate schedule for same agent", () => {
		runPipeline(`schedule:add digest --every daily ${dbFlag}`);
		expect(() =>
			runPipeline(`schedule:add digest --every hourly ${dbFlag}`),
		).toThrow();
	});

	it("removes a schedule", () => {
		runPipeline(`schedule:add digest --every daily ${dbFlag}`);
		const output = runPipeline(`schedule:remove digest ${dbFlag}`);
		expect(output).toContain('Removed schedule for "digest"');

		const list = runPipeline(`schedule:list --json ${dbFlag}`);
		const schedules = JSON.parse(list);
		expect(schedules).toHaveLength(0);
	});

	it("remove rejects unknown schedule", () => {
		expect(() =>
			runPipeline(`schedule:remove nonexistent ${dbFlag}`),
		).toThrow();
	});

	it("list shows empty state", () => {
		const output = runPipeline(`schedule:list ${dbFlag}`);
		expect(output).toContain("No scheduled agents");
	});

	it("schedule:run with no schedules does nothing", () => {
		const output = runPipeline(`schedule:run ${dbFlag}`);
		expect(output).toContain("No agents due");
	});
});

describe("isDue logic", () => {
	const base = {
		id: 1,
		agent_name: "digest",
		enabled: true,
		created_at: new Date().toISOString(),
	};

	it("returns true when last_run_at is null", () => {
		expect(isDue({ ...base, interval: "daily", last_run_at: null })).toBe(true);
	});

	it("returns true when enough time has passed", () => {
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		expect(
			isDue({ ...base, interval: "hourly", last_run_at: twoHoursAgo }),
		).toBe(true);
	});

	it("returns false when not enough time has passed", () => {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		expect(
			isDue({
				...base,
				interval: "hourly",
				last_run_at: fiveMinutesAgo,
			}),
		).toBe(false);
	});

	it("weekdays returns false on Saturday/Sunday", () => {
		const now = new Date();
		const day = now.getDay();
		const isWeekend = day === 0 || day === 6;

		// last_run_at null so it would be due unless weekend
		const result = isDue({
			...base,
			interval: "weekdays",
			last_run_at: null,
		});
		if (isWeekend) {
			expect(result).toBe(false);
		} else {
			expect(result).toBe(true);
		}
	});
});
