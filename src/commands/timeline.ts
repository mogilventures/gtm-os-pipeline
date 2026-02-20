import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { getTimeline } from "../services/timeline.js";
import { formatJson, formatTable } from "../utils/output.js";
import { resolveContactId } from "../utils/resolve.js";

export default class Timeline extends BaseCommand {
	static override description = "Show chronological activity feed";

	static override examples = [
		"<%= config.bin %> timeline",
		"<%= config.bin %> timeline --last-days 7 --type interaction",
		"<%= config.bin %> timeline --contact jane",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		"last-days": Flags.string({
			char: "d",
			description: "Time window in days",
			default: "30",
		}),
		type: Flags.string({
			char: "t",
			description: "Filter by event type: interaction, task_completed, deal_created, deal_closed",
		}),
		contact: Flags.string({
			description: "Filter by contact name (fuzzy match)",
		}),
		limit: Flags.integer({
			char: "l",
			description: "Max events to show",
			default: 50,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Timeline);
		const db = getDb(flags.db);

		const lastDays = Number.parseInt(flags["last-days"], 10);
		let contactId: number | undefined;

		if (flags.contact) {
			const match = await resolveContactId(db, flags.contact);
			contactId = match.id;
		}

		const events = getTimeline(db, {
			lastDays,
			type: flags.type,
			contactId,
			limit: flags.limit,
		});

		if (flags.json) {
			this.log(formatJson(events));
			return;
		}

		if (events.length === 0) {
			this.log("No activity found");
			return;
		}

		this.log(`Activity Timeline (last ${lastDays} days)`);
		this.log("=".repeat(50));
		this.log("");
		this.log(
			formatTable(
				["Date", "Type", "Summary"],
				events.map((e) => [
					e.timestamp.split("T")[0],
					e.type,
					e.summary,
				]),
			),
		);
		this.log(`\nShowing ${events.length} event${events.length === 1 ? "" : "s"}`);
	}
}
