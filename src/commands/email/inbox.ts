import { Flags } from "@oclif/core";
import chalk from "chalk";
import Table from "cli-table3";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listInteractions } from "../../services/interactions.js";
import { formatJson } from "../../utils/output.js";

export default class EmailInbox extends BaseCommand {
	static override description = "List recent inbound emails";

	static override examples = [
		"<%= config.bin %> email:inbox",
		"<%= config.bin %> email:inbox --limit 20",
		"<%= config.bin %> email:inbox --last-days 7",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		limit: Flags.integer({
			description: "Maximum emails to show",
			default: 25,
		}),
		"last-days": Flags.integer({
			description: "Only show emails from last N days",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(EmailInbox);
		const db = getDb(flags.db);

		const rows = listInteractions(db, {
			type: "email",
			lastDays: flags["last-days"],
		}).filter((r) => r.direction === "inbound");

		const limited = rows
			.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
			.slice(0, flags.limit);

		if (limited.length === 0) {
			this.log("No inbound emails. Run `pipeline email:sync` to sync.");
			return;
		}

		if (flags.json) {
			this.log(formatJson(limited));
			return;
		}

		const table = new Table({
			head: ["Date", "From", "Subject"],
			style: { head: ["cyan"] },
		});

		for (const row of limited) {
			const date = row.occurred_at.slice(0, 10);
			const from = row.contact_name || row.from_address || "(unknown)";
			const subject = row.subject || "(no subject)";
			table.push([date, from, subject]);
		}

		this.log(table.toString());
	}
}
