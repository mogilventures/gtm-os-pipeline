import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getContactsForFuzzy } from "../../services/contacts.js";
import { sendEmail } from "../../services/email.js";
import { logInteraction } from "../../services/interactions.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class EmailSend extends BaseCommand {
	static override description = "Send an email to a contact";

	static override examples = [
		'<%= config.bin %> email:send jane --subject "Quick follow-up" --body "Hey Jane, wanted to check in..."',
	];

	static override args = {
		contact: Args.string({
			description: "Contact name (fuzzy matched)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		subject: Flags.string({
			description: "Email subject",
			required: true,
		}),
		body: Flags.string({
			description: "Email body",
			required: true,
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(EmailSend);
		const db = getDb(flags.db);

		const contacts = getContactsForFuzzy(db);
		const match = await fuzzyResolve(contacts, args.contact, "contact", [
			"name",
			"email",
		]);

		if (!match.email) {
			this.error(`Contact "${match.name}" has no email address`);
		}

		const result = await sendEmail({
			to: match.email,
			subject: flags.subject,
			body: flags.body,
		});

		logInteraction(db, {
			contactId: match.id,
			type: "email",
			direction: "outbound",
			subject: flags.subject,
			body: flags.body,
			messageId: result.id,
		});

		this.log(
			`Email sent to ${match.name} <${match.email}> via ${result.provider}`,
		);
		this.log(`Subject: ${flags.subject}`);

		if (flags.json) {
			this.log(JSON.stringify({ sent: true, to: match.email, id: result.id }));
		}
	}
}
