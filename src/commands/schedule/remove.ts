import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { removeSchedule } from "../../services/schedule.js";

export default class ScheduleRemove extends BaseCommand {
	static override description = "Remove a scheduled agent";

	static override args = {
		agent: Args.string({
			description: "Agent name to unschedule",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ScheduleRemove);
		const db = getDb(flags.db);

		removeSchedule(db, args.agent);
		this.log(`Removed schedule for "${args.agent}"`);
	}
}
