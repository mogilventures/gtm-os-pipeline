import { Args } from "@oclif/core";
import { BaseCommand } from "../../../base-command.js";
import { getDb } from "../../../db/index.js";

export default class TriggersRemove extends BaseCommand {
	static override description = "Remove a Composio trigger";

	static override args = {
		id: Args.integer({
			description: "Trigger ID (from integrations:triggers:list)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TriggersRemove);
		const db = getDb(flags.db);

		const { removeTrigger } = await import("../../../services/composio.js");

		await removeTrigger(db, args.id);
		this.log(`Trigger ${args.id} removed.`);
	}
}
