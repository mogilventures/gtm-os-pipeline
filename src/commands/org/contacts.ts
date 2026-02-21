import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	getOrgContacts,
	getOrgsForFuzzy,
} from "../../services/organizations.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class OrgContacts extends BaseCommand {
	static override description = "List contacts at an organization";

	static override args = {
		name: Args.string({
			description: "Organization name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(OrgContacts);
		const db = getDb(flags.db);

		const orgs = getOrgsForFuzzy(db);
		const match = await fuzzyResolve(orgs, args.name, "organization");
		const contacts = getOrgContacts(db, match.id);

		if (flags.json) {
			this.log(formatJson(contacts));
			return;
		}

		if (contacts.length === 0) {
			this.log(`No contacts at ${match.name}.`);
			return;
		}

		this.log(`Contacts at ${match.name}:`);
		this.log(
			formatTable(
				["ID", "Name", "Email", "Role", "Warmth"],
				contacts.map((c) => [c.id, c.name, c.email, c.role, c.warmth]),
			),
		);
	}
}
