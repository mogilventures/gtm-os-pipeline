import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getContactsForFuzzy } from "../../services/contacts.js";
import { logInteraction } from "../../services/interactions.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class LogMeeting extends BaseCommand {
	static override description = "Log a meeting interaction";

	static override args = {
		contact: Args.string({ description: "Contact name (fuzzy match)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		body: Flags.string({ description: "Meeting notes" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(LogMeeting);
		const db = getDb(flags.db);

		const contacts = getContactsForFuzzy(db);
		const match = await fuzzyResolve(contacts, args.contact, "contact", ["name", "email"]);

		const interaction = logInteraction(db, {
			contactId: match.id,
			type: "meeting",
			body: flags.body,
		});

		this.log(`Logged meeting with ${match.name} (id: ${interaction.id})`);
	}
}
