import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { getAgent } from "./subagents.js";

type Schedule = typeof schema.schedules.$inferSelect;
type ScheduleLog = typeof schema.scheduleLogs.$inferSelect;

const INTERVALS = ["hourly", "daily", "weekdays", "weekly"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_MS: Record<Interval, number> = {
	hourly: 60 * 60 * 1000,
	daily: 24 * 60 * 60 * 1000,
	weekdays: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
};

export function isValidInterval(s: string): s is Interval {
	return INTERVALS.includes(s as Interval);
}

export function addSchedule(
	db: PipelineDB,
	agentName: string,
	interval: string,
): Schedule {
	const agent = getAgent(agentName);
	if (!agent) throw new Error(`Agent not found: "${agentName}"`);
	if (!isValidInterval(interval))
		throw new Error(
			`Invalid interval: "${interval}". Must be one of: ${INTERVALS.join(", ")}`,
		);

	return db
		.insert(schema.schedules)
		.values({ agent_name: agentName, interval })
		.returning()
		.get();
}

export function removeSchedule(db: PipelineDB, agentName: string): void {
	const existing = db
		.select()
		.from(schema.schedules)
		.where(eq(schema.schedules.agent_name, agentName))
		.get();
	if (!existing) throw new Error(`No schedule found for "${agentName}"`);

	db.delete(schema.schedules)
		.where(eq(schema.schedules.agent_name, agentName))
		.run();
}

export function listSchedules(db: PipelineDB): Schedule[] {
	return db.select().from(schema.schedules).all();
}

export function getScheduleLogs(db: PipelineDB, limit = 20): ScheduleLog[] {
	return db
		.select()
		.from(schema.scheduleLogs)
		.orderBy(schema.scheduleLogs.started_at)
		.limit(limit)
		.all();
}

export function isDue(schedule: Schedule): boolean {
	if (!schedule.enabled) return false;

	const now = new Date();
	const interval = schedule.interval as Interval;

	if (interval === "weekdays") {
		const day = now.getDay();
		if (day === 0 || day === 6) return false;
	}

	if (!schedule.last_run_at) return true;

	const elapsed = now.getTime() - new Date(schedule.last_run_at).getTime();
	return elapsed >= INTERVAL_MS[interval];
}

interface RunResult {
	agentName: string;
	status: "completed" | "failed";
	actionsProposed: number;
	output: string;
}

export async function runDueSchedules(
	db: PipelineDB,
	dbPath: string,
	opts: { verbose?: boolean; agentName?: string },
): Promise<RunResult[]> {
	const allSchedules = listSchedules(db);
	let due: Schedule[];

	if (opts.agentName) {
		const match = allSchedules.find((s) => s.agent_name === opts.agentName);
		if (!match) throw new Error(`No schedule found for "${opts.agentName}"`);
		due = [match];
	} else {
		due = allSchedules.filter(isDue);
	}

	if (due.length === 0) return [];

	const { runAgent } = await import("./agent-runner.js");
	const { loadConfig } = await import("../config.js");
	const { approveAll } = await import("./approval.js");
	const config = loadConfig();

	const results: RunResult[] = [];

	for (const schedule of due) {
		const agent = getAgent(schedule.agent_name);
		if (!agent) continue;

		const logRow = db
			.insert(schema.scheduleLogs)
			.values({
				schedule_id: schedule.id,
				agent_name: schedule.agent_name,
				started_at: new Date().toISOString(),
			})
			.returning()
			.get();

		const outputParts: string[] = [];
		let status: "completed" | "failed" = "completed";

		try {
			await runAgent({
				prompt: `Run scheduled ${schedule.agent_name} agent.`,
				systemPrompt: agent.prompt,
				dbPath,
				verbose: opts.verbose,
				onText: (text) => {
					outputParts.push(text);
				},
			});

			const pendingCount = db
				.select()
				.from(schema.pendingActions)
				.where(eq(schema.pendingActions.status, "pending"))
				.all().length;

			if (config.agent.auto_approve) {
				await approveAll(db);
			}

			db.update(schema.schedules)
				.set({ last_run_at: new Date().toISOString() })
				.where(eq(schema.schedules.id, schedule.id))
				.run();

			db.update(schema.scheduleLogs)
				.set({
					status: "completed",
					finished_at: new Date().toISOString(),
					output: outputParts.join(""),
					actions_proposed: pendingCount,
				})
				.where(eq(schema.scheduleLogs.id, logRow.id))
				.run();

			results.push({
				agentName: schedule.agent_name,
				status: "completed",
				actionsProposed: pendingCount,
				output: outputParts.join(""),
			});
		} catch (error) {
			status = "failed";
			const errMsg = error instanceof Error ? error.message : String(error);

			db.update(schema.scheduleLogs)
				.set({
					status: "failed",
					finished_at: new Date().toISOString(),
					output: errMsg,
				})
				.where(eq(schema.scheduleLogs.id, logRow.id))
				.run();

			db.update(schema.schedules)
				.set({ last_run_at: new Date().toISOString() })
				.where(eq(schema.schedules.id, schedule.id))
				.run();

			results.push({
				agentName: schedule.agent_name,
				status: "failed",
				actionsProposed: 0,
				output: errMsg,
			});
		}
	}

	return results;
}
