import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listInteractions } from "../../services/interactions.js";
import { parseDays } from "../../utils/dates.js";
import { formatJson, formatTable } from "../../utils/output.js";
import { resolveContactId, resolveDealId } from "../../utils/resolve.js";

export default class LogList extends BaseCommand {
	static override description = "List interaction logs";

	static override flags = {
		...BaseCommand.baseFlags,
		contact: Flags.string({ description: "Filter by contact (fuzzy match)" }),
		type: Flags.string({
			description: "Filter by type",
			options: ["email", "call", "meeting", "note"],
		}),
		last: Flags.string({ description: "Show last N days (e.g. 30d)" }),
		deal: Flags.string({ description: "Filter by deal (fuzzy match)" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(LogList);
		const db = getDb(flags.db);

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;
		const dealId = flags.deal ? await resolveDealId(db, flags.deal) : undefined;

		const interactions = listInteractions(db, {
			contactId,
			type: flags.type,
			lastDays: flags.last ? parseDays(flags.last) : undefined,
			dealId,
		});

		if (flags.json) {
			this.log(formatJson(interactions));
			return;
		}

		if (interactions.length === 0) {
			this.log("No interactions found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Type", "Direction", "Contact", "Subject", "Date"],
				interactions.map((i) => [
					i.id,
					i.type,
					i.direction,
					i.contact_name,
					i.subject || (i.body ? i.body.slice(0, 30) : ""),
					i.occurred_at,
				]),
			),
		);
	}
}
