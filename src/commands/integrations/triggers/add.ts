import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../../base-command.js";
import { getDb } from "../../../db/index.js";

export default class TriggersAdd extends BaseCommand {
	static override description = "Add a Composio trigger";

	static override examples = [
		"<%= config.bin %> integrations:triggers:add GMAIL_NEW_EMAIL",
		'<%= config.bin %> integrations:triggers:add GMAIL_NEW_EMAIL --config \'{"label":"INBOX"}\'',
		"<%= config.bin %> integrations:triggers:add SLACK_NEW_MESSAGE --account 1",
	];

	static override args = {
		slug: Args.string({
			description: "Trigger slug (e.g. GMAIL_NEW_EMAIL)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		config: Flags.string({
			description: "Trigger config as JSON string",
		}),
		account: Flags.integer({
			description: "Connected account ID to use for this trigger",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TriggersAdd);
		const db = getDb(flags.db);

		const { createTrigger } = await import("../../../services/composio.js");

		let triggerConfig: Record<string, unknown> | undefined;
		if (flags.config) {
			try {
				triggerConfig = JSON.parse(flags.config);
			} catch {
				this.error("Invalid JSON in --config flag");
			}
		}

		const result = await createTrigger(
			db,
			args.slug,
			triggerConfig,
			flags.account,
		);

		if (flags.json) {
			this.log(JSON.stringify(result, null, 2));
		} else {
			this.log(
				`Trigger added: ${args.slug} (ID: ${result.id}, Composio: ${result.trigger_id})`,
			);
		}
	}
}
