import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { removeHook } from "../../services/events.js";

export default class HookRemove extends BaseCommand {
	static override description = "Remove an event hook";

	static override args = {
		event: Args.string({
			description: "Event type",
			required: true,
		}),
		agent: Args.string({
			description: "Agent name",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(HookRemove);
		const db = getDb(flags.db);

		removeHook(db, args.event, args.agent);
		this.log(`Hook removed: ${args.event} → ${args.agent}`);
	}
}
