import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listConnectedAccounts } from "../../services/composio.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class IntegrationsList extends BaseCommand {
	static override description = "List all connected integration accounts";

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(IntegrationsList);
		const db = getDb(flags.db);

		const accounts = listConnectedAccounts(db);

		if (accounts.length === 0) {
			this.log("No connected accounts.");
			this.log('Use "pipeline integrations:connect <toolkit>" to add one.');
			return;
		}

		if (flags.json) {
			this.log(formatJson(accounts));
			return;
		}

		this.log(
			formatTable(
				["ID", "Toolkit", "Label", "Status", "Created"],
				accounts.map((a) => [a.id, a.toolkit, a.label, a.status, a.created_at]),
			),
		);
	}
}
