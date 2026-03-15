import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addTemplate } from "../../services/email-templates.js";
import { formatJson } from "../../utils/output.js";

export default class TemplateAdd extends BaseCommand {
	static override description = "Add a new email template";

	static override examples = [
		'<%= config.bin %> template:add "follow-up" --subject "Following up, {{first_name}}" --body "Hi {{first_name}}, wanted to check in about {{company}}..."',
	];

	static override args = {
		name: Args.string({ description: "Template name", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		subject: Flags.string({
			description: "Email subject (supports {{variables}})",
			required: true,
		}),
		body: Flags.string({
			description: "Email body (supports {{variables}})",
			required: true,
		}),
		category: Flags.string({
			description: "Template category",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TemplateAdd);
		const db = getDb(flags.db);

		const template = addTemplate(db, {
			name: args.name,
			subject: flags.subject,
			body: flags.body,
			category: flags.category,
		});

		if (flags.json) {
			this.log(formatJson(template));
		} else if (flags.quiet) {
			this.log(String(template.id));
		} else {
			this.log(`Added template: ${template.name} (id: ${template.id})`);
			const vars = template.variables as string[];
			if (vars.length > 0) {
				this.log(`Variables: ${vars.join(", ")}`);
			}
		}
	}
}
