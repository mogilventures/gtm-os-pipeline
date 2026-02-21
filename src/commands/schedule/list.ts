import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listSchedules } from "../../services/schedule.js";

export default class ScheduleList extends BaseCommand {
	static override description = "List all scheduled agents";

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ScheduleList);
		const db = getDb(flags.db);

		const schedules = listSchedules(db);

		if (flags.json) {
			this.log(JSON.stringify(schedules, null, 2));
			return;
		}

		if (schedules.length === 0) {
			this.log("No scheduled agents. Use `pipeline schedule:add` to add one.");
			return;
		}

		this.log("Scheduled Agents:\n");
		for (const s of schedules) {
			const status = s.enabled ? "enabled" : "disabled";
			const lastRun = s.last_run_at || "never";
			this.log(
				`  ${s.agent_name}  ${s.interval}  (${status})  last run: ${lastRun}`,
			);
		}
	}
}
