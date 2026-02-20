import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addContact } from "../../services/contacts.js";
import { formatJson } from "../../utils/output.js";

export default class ContactAdd extends BaseCommand {
	static override description = "Add a new contact";

	static override examples = [
		'<%= config.bin %> contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO',
	];

	static override args = {
		name: Args.string({ description: "Contact name", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		email: Flags.string({ description: "Email address" }),
		org: Flags.string({ description: "Organization name" }),
		role: Flags.string({ description: "Role/title" }),
		tag: Flags.string({ description: "Tag (can specify multiple)", multiple: true }),
		source: Flags.string({ description: "How you met" }),
		warmth: Flags.string({
			description: "Relationship warmth",
			options: ["cold", "warm", "hot"],
		}),
		phone: Flags.string({ description: "Phone number" }),
		linkedin: Flags.string({ description: "LinkedIn URL" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ContactAdd);
		const db = getDb(flags.db);

		const contact = addContact(db, {
			name: args.name,
			email: flags.email,
			phone: flags.phone,
			linkedin: flags.linkedin,
			role: flags.role,
			org: flags.org,
			tags: flags.tag,
			source: flags.source,
			warmth: flags.warmth,
		});

		if (flags.json) {
			this.log(formatJson(contact));
		} else if (flags.quiet) {
			this.log(String(contact.id));
		} else {
			this.log(`Added contact: ${contact.name} (id: ${contact.id})`);
			if (contact.org_name) this.log(`  Org: ${contact.org_name}`);
			if (contact.role) this.log(`  Role: ${contact.role}`);
			if (contact.email) this.log(`  Email: ${contact.email}`);
		}
	}
}
