import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getContactsForFuzzy } from "../../services/contacts.js";
import { sendEmail } from "../../services/email.js";
import {
	buildContactVariables,
	getTemplate,
	getTemplatesForFuzzy,
	renderTemplate,
} from "../../services/email-templates.js";
import { logInteraction } from "../../services/interactions.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class EmailSend extends BaseCommand {
	static override description = "Send an email to a contact";

	static override examples = [
		'<%= config.bin %> email:send jane --subject "Quick follow-up" --body "Hey Jane, wanted to check in..."',
		"<%= config.bin %> email:send jane --template follow-up",
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
		}),
		body: Flags.string({
			description: "Email body",
		}),
		template: Flags.string({
			description: "Template name (fuzzy matched)",
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

		let subject = flags.subject;
		let body = flags.body;
		let templateName: string | undefined;

		if (flags.template) {
			const templates = getTemplatesForFuzzy(db);
			const tmplMatch = await fuzzyResolve(
				templates,
				flags.template,
				"template",
			);
			const tmpl = getTemplate(db, tmplMatch.id);
			if (!tmpl) {
				this.error("Template not found");
			}

			const vars = buildContactVariables(db, match.id);
			const rendered = renderTemplate(tmpl, vars);

			subject = flags.subject ?? rendered.subject;
			body = flags.body ?? rendered.body;
			templateName = tmpl.name;
		}

		if (!subject || !body) {
			this.error("Must provide --subject and --body, or use --template");
		}

		const result = await sendEmail({
			to: match.email,
			subject,
			body,
		});

		logInteraction(db, {
			contactId: match.id,
			type: "email",
			direction: "outbound",
			subject,
			body,
			messageId: result.id,
		});

		this.log(
			`Email sent to ${match.name} <${match.email}> via ${result.provider}`,
		);
		if (templateName) {
			this.log(`Template: ${templateName}`);
		}
		this.log(`Subject: ${subject}`);

		if (flags.json) {
			this.log(
				JSON.stringify({
					sent: true,
					to: match.email,
					id: result.id,
					template: templateName,
				}),
			);
		}
	}
}
