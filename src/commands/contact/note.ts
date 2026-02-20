import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addNote } from "../../services/contacts.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class ContactNote extends BaseCommand {
	static override description = "Add a note to a contact";

	static override examples = [
		'<%= config.bin %> contact:note "Jane Smith" "Great meeting today"',
	];

	static override args = {
		name: Args.string({ description: "Contact name (fuzzy match)", required: true }),
		body: Args.string({ description: "Note body", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ContactNote);
		const db = getDb(flags.db);

		const match = await resolveContactId(db, args.name);

		const interaction = addNote(db, match.id, args.body);
		this.log(`Note added for ${match.name} (interaction id: ${interaction.id})`);
	}
}
