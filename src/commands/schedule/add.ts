import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addSchedule } from "../../services/schedule.js";

export default class ScheduleAdd extends BaseCommand {
	static override description = "Schedule an agent to run automatically";

	static override args = {
		agent: Args.string({
			description: "Agent name (e.g. digest, follow-up)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		every: Flags.string({
			description: "Run interval: hourly, daily, weekdays, weekly",
			required: true,
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ScheduleAdd);
		const db = getDb(flags.db);

		const schedule = addSchedule(db, args.agent, flags.every);

		if (flags.json) {
			this.log(JSON.stringify(schedule, null, 2));
		} else {
			this.log(
				`Scheduled "${schedule.agent_name}" to run ${schedule.interval}`,
			);
		}
	}
}
