import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb, getDbPath } from "../../db/index.js";
import { processEvents, scanForTimeEvents } from "../../services/events.js";
import { runDueSchedules } from "../../services/schedule.js";

export default class ScheduleRun extends BaseCommand {
	static override description =
		"Run all due scheduled agents (designed for crontab)";

	static override flags = {
		...BaseCommand.baseFlags,
		agent: Flags.string({
			description: "Force-run a specific agent regardless of schedule timing",
		}),
		hooks: Flags.boolean({
			description: "Also process event hooks after running schedules",
			default: true,
			allowNo: true,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ScheduleRun);
		const db = getDb(flags.db);
		const dbPath = getDbPath(flags.db);

		const results = await runDueSchedules(db, dbPath, {
			verbose: flags.verbose,
			agentName: flags.agent,
		});

		if (flags.json) {
			this.log(JSON.stringify(results, null, 2));
			return;
		}

		if (results.length === 0) {
			this.log("No agents due to run.");
		} else {
			for (const r of results) {
				const icon = r.status === "completed" ? "OK" : "FAIL";
				this.log(
					`[${icon}] ${r.agentName}: ${r.actionsProposed} action(s) proposed`,
				);
				if (flags.verbose && r.output) {
					this.log(r.output);
				}
			}
		}

		// Poll Composio triggers
		try {
			const { pollTriggerEvents } = await import("../../services/composio.js");
			const triggerCount = await pollTriggerEvents(db);
			if (triggerCount > 0 && flags.verbose) {
				this.log(`[COMPOSIO] ${triggerCount} trigger event(s) received`);
			}
		} catch {
			/* Composio not configured — skip */
		}

		// Process event hooks if enabled
		if (flags.hooks) {
			scanForTimeEvents(db);
			const hookResults = processEvents(db);
			if (hookResults.length > 0 && flags.verbose) {
				for (const hr of hookResults) {
					this.log(`[HOOK] ${hr.eventType} → ${hr.agentName} (${hr.status})`);
				}
			}
		}
	}
}
