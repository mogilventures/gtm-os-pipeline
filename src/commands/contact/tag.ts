import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { tagContact } from "../../services/contacts.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class ContactTag extends BaseCommand {
	static override description = "Add or remove tags from a contact";

	static override examples = [
		'<%= config.bin %> contact:tag "Jane Smith" +investor +vip -cold-lead',
	];

	static override strict = false;

	static override args = {
		name: Args.string({
			description: "Contact name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, argv, flags } = await this.parse(ContactTag);
		const db = getDb(flags.db);

		const rawArgs = argv as string[];
		const add: string[] = [];
		const remove: string[] = [];

		for (const arg of rawArgs) {
			if (arg.startsWith("+")) {
				add.push(arg.slice(1));
			} else if (arg.startsWith("-")) {
				remove.push(arg.slice(1));
			}
		}

		if (add.length === 0 && remove.length === 0) {
			this.error(
				"Specify tags with + to add or - to remove. Example: +investor -cold-lead",
			);
		}

		const match = await resolveContactId(db, args.name);

		const tags = tagContact(db, match.id, add, remove);
		this.log(`Tags for ${match.name}: ${tags.join(", ") || "(none)"}`);
	}
}
