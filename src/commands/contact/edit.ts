import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { editContact, getContactsForFuzzy } from "../../services/contacts.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class ContactEdit extends BaseCommand {
	static override description = "Edit a contact";

	static override args = {
		name: Args.string({ description: "Contact name (fuzzy match)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		role: Flags.string({ description: "New role" }),
		warmth: Flags.string({ description: "New warmth", options: ["cold", "warm", "hot"] }),
		org: Flags.string({ description: "New organization" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ContactEdit);
		const db = getDb(flags.db);

		const contacts = getContactsForFuzzy(db);
		const match = await fuzzyResolve(contacts, args.name, "contact", ["name", "email"]);

		editContact(db, match.id, {
			role: flags.role,
			warmth: flags.warmth,
			org: flags.org,
		});

		this.log(`Updated contact: ${match.name}`);
	}
}
