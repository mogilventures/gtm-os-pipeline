import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { syncInboundEmails } from "../../services/email-sync.js";

export default class EmailSync extends BaseCommand {
	static override description = "Sync inbound emails from Resend";

	static override examples = [
		"<%= config.bin %> email:sync",
		"<%= config.bin %> email:sync --limit 100",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		limit: Flags.integer({
			description: "Maximum emails to fetch",
			default: 50,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(EmailSync);
		const db = getDb(flags.db);

		const result = await syncInboundEmails(db, { limit: flags.limit });

		if (flags.json) {
			this.log(JSON.stringify(result));
			return;
		}

		this.log(`Synced: ${result.synced} new emails`);
		if (result.skipped > 0) {
			this.log(`Skipped: ${result.skipped} (already imported)`);
		}
		if (result.unmatched.length > 0) {
			this.log(`Unmatched senders: ${result.unmatched.join(", ")}`);
			this.log(
				"Tip: use `pipeline contact:add` to add these senders, then re-check.",
			);
		}
	}
}
