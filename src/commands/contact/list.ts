import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listContacts } from "../../services/contacts.js";
import { parseDays } from "../../utils/dates.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class ContactList extends BaseCommand {
	static override description = "List contacts";

	static override examples = [
		"<%= config.bin %> contact:list",
		"<%= config.bin %> contact:list --tag investor",
		"<%= config.bin %> contact:list --stale 30d",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		tag: Flags.string({ description: "Filter by tag" }),
		org: Flags.string({ description: "Filter by organization" }),
		warmth: Flags.string({ description: "Filter by warmth" }),
		stale: Flags.string({
			description: "Show contacts not updated in N days (e.g. 30d)",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ContactList);
		const db = getDb(flags.db);

		const contacts = listContacts(db, {
			tag: flags.tag,
			org: flags.org,
			warmth: flags.warmth,
			staleDays: flags.stale ? parseDays(flags.stale) : undefined,
		});

		if (flags.json) {
			this.log(formatJson(contacts));
			return;
		}

		if (flags.quiet) {
			this.log(contacts.map((c) => c.id).join("\n"));
			return;
		}

		if (contacts.length === 0) {
			this.log("No contacts found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Name", "Email", "Org", "Role", "Warmth", "Tags"],
				contacts.map((c) => [
					c.id,
					c.name,
					c.email,
					c.org_name,
					c.role,
					c.warmth,
					c.tags.join(", "),
				]),
			),
		);
	}
}
