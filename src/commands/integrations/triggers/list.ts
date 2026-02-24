import { BaseCommand } from "../../../base-command.js";
import { getDb } from "../../../db/index.js";
import { listTriggers } from "../../../services/composio.js";
import { formatJson, formatTable } from "../../../utils/output.js";

export default class TriggersList extends BaseCommand {
	static override description = "List all Composio triggers";

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(TriggersList);
		const db = getDb(flags.db);

		const triggers = listTriggers(db);

		if (triggers.length === 0) {
			this.log("No triggers configured.");
			this.log('Use "pipeline integrations:triggers:add <slug>" to add one.');
			return;
		}

		if (flags.json) {
			this.log(formatJson(triggers));
			return;
		}

		this.log(
			formatTable(
				["ID", "Trigger", "Toolkit", "Enabled", "Last Polled"],
				triggers.map((t) => [
					t.id,
					t.trigger_slug,
					t.toolkit,
					t.enabled ? "yes" : "no",
					t.last_polled_at || "never",
				]),
			),
		);
	}
}
