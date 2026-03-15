import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	completeMilestone,
	getMilestonesForFuzzy,
} from "../../services/projects.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class MilestoneDone extends BaseCommand {
	static override description = "Mark a milestone as complete";

	static override args = {
		name: Args.string({
			description: "Milestone name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(MilestoneDone);
		const db = getDb(flags.db);

		const milestones = getMilestonesForFuzzy(db);
		const match = await fuzzyResolve(milestones, args.name, "milestone");

		completeMilestone(db, match.id);
		this.log(`Completed milestone: ${match.name}`);
	}
}
