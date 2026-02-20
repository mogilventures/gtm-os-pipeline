import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getContactsForFuzzy, removeContact } from "../../services/contacts.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class ContactRm extends BaseCommand {
	static override description = "Remove a contact";

	static override args = {
		name: Args.string({ description: "Contact name (fuzzy match)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		confirm: Flags.boolean({ description: "Skip confirmation prompt", default: false }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ContactRm);
		const db = getDb(flags.db);

		const contacts = getContactsForFuzzy(db);
		const match = await fuzzyResolve(contacts, args.name, "contact", ["name", "email"]);

		if (!flags.confirm && process.stdin.isTTY) {
			const { confirm } = await import("@inquirer/prompts");
			const ok = await confirm({ message: `Remove contact "${match.name}"?` });
			if (!ok) {
				this.log("Cancelled.");
				return;
			}
		}

		removeContact(db, match.id);
		this.log(`Removed contact: ${match.name}`);
	}
}
