import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb, getDbPath } from "../../db/index.js";
import { runDueSchedules } from "../../services/schedule.js";

export default class ScheduleRun extends BaseCommand {
	static override description =
		"Run all due scheduled agents (designed for crontab)";

	static override flags = {
		...BaseCommand.baseFlags,
		agent: Flags.string({
			description: "Force-run a specific agent regardless of schedule timing",
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
			return;
		}

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
}
