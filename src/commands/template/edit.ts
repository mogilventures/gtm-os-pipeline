import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	editTemplate,
	getTemplate,
	getTemplatesForFuzzy,
} from "../../services/email-templates.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson } from "../../utils/output.js";

export default class TemplateEdit extends BaseCommand {
	static override description = "Edit an email template";

	static override args = {
		name: Args.string({
			description: "Template name (fuzzy matched)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		subject: Flags.string({ description: "New subject" }),
		body: Flags.string({ description: "New body" }),
		category: Flags.string({ description: "New category" }),
		name: Flags.string({ description: "New name" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TemplateEdit);
		const db = getDb(flags.db);

		const templates = getTemplatesForFuzzy(db);
		const match = await fuzzyResolve(templates, args.name, "template");

		editTemplate(db, match.id, {
			name: flags.name,
			subject: flags.subject,
			body: flags.body,
			category: flags.category,
		});

		const updated = getTemplate(db, match.id);

		if (flags.json) {
			this.log(formatJson(updated));
		} else {
			this.log(`Updated template: ${updated!.name}`);
			const vars = updated!.variables as string[];
			if (vars.length > 0) {
				this.log(`Variables: ${vars.join(", ")}`);
			}
		}
	}
}
