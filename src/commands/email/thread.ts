import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getContactsForFuzzy } from "../../services/contacts.js";
import { listInteractions } from "../../services/interactions.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson } from "../../utils/output.js";

export default class EmailThread extends BaseCommand {
	static override description = "Show email conversation with a contact";

	static override examples = [
		"<%= config.bin %> email:thread jane",
		"<%= config.bin %> email:thread jane --limit 10",
	];

	static override args = {
		contact: Args.string({
			description: "Contact name (fuzzy matched)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		limit: Flags.integer({
			description: "Maximum emails to show",
			default: 20,
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(EmailThread);
		const db = getDb(flags.db);

		const contacts = getContactsForFuzzy(db);
		const match = await fuzzyResolve(contacts, args.contact, "contact", [
			"name",
			"email",
		]);

		const rows = listInteractions(db, {
			contactId: match.id,
			type: "email",
		})
			.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
			.slice(-flags.limit);

		if (rows.length === 0) {
			this.log(`No email history with ${match.name}.`);
			return;
		}

		if (flags.json) {
			this.log(formatJson(rows));
			return;
		}

		this.log(chalk.bold(`Email thread with ${match.name}`));
		this.log("─".repeat(50));

		for (const row of rows) {
			const arrow =
				row.direction === "inbound"
					? chalk.green("← IN ")
					: chalk.blue("→ OUT");
			const date = row.occurred_at.slice(0, 16).replace("T", " ");
			const subject = row.subject || "(no subject)";

			this.log(`\n${arrow}  ${date}`);
			this.log(`  Subject: ${subject}`);
			if (row.body) {
				const preview =
					row.body.length > 200 ? `${row.body.slice(0, 200)}...` : row.body;
				this.log(`  ${preview}`);
			}
		}
	}
}
