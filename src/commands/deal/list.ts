import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listDeals } from "../../services/deals.js";
import { parseDays } from "../../utils/dates.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class DealList extends BaseCommand {
	static override description = "List deals";

	static override flags = {
		...BaseCommand.baseFlags,
		stage: Flags.string({ description: "Filter by stage" }),
		priority: Flags.string({ description: "Filter by priority" }),
		closing: Flags.string({
			description: "Show deals closing within N days (e.g. 30d)",
		}),
		value: Flags.integer({ description: "Minimum deal value" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(DealList);
		const db = getDb(flags.db);

		const deals = listDeals(db, {
			stage: flags.stage,
			priority: flags.priority,
			closingDays: flags.closing ? parseDays(flags.closing) : undefined,
			minValue: flags.value,
		});

		if (flags.json) {
			this.log(formatJson(deals));
			return;
		}
		if (flags.quiet) {
			this.log(deals.map((d) => d.id).join("\n"));
			return;
		}
		if (deals.length === 0) {
			this.log("No deals found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Title", "Stage", "Value", "Priority", "Contact", "Close"],
				deals.map((d) => [
					d.id,
					d.title,
					d.stage,
					d.value ? `$${d.value}` : "",
					d.priority,
					d.contact_name,
					d.expected_close,
				]),
			),
		);
	}
}
