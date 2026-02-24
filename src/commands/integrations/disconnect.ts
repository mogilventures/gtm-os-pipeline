import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";

export default class IntegrationsDisconnect extends BaseCommand {
	static override description = "Disconnect an integration account";

	static override args = {
		id: Args.integer({
			description: "Connected account ID (from integrations:list)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(IntegrationsDisconnect);
		const db = getDb(flags.db);

		const { disconnectAccount } = await import("../../services/composio.js");

		await disconnectAccount(db, args.id);
		this.log(`Disconnected account ${args.id}.`);
	}
}
