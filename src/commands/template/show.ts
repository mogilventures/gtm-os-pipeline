import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	getTemplate,
	getTemplatesForFuzzy,
} from "../../services/email-templates.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson } from "../../utils/output.js";

export default class TemplateShow extends BaseCommand {
	static override description = "Show an email template";

	static override args = {
		name: Args.string({
			description: "Template name (fuzzy matched)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(TemplateShow);
		const db = getDb(flags.db);

		const templates = getTemplatesForFuzzy(db);
		const match = await fuzzyResolve(templates, args.name, "template");

		const template = getTemplate(db, match.id);
		if (!template) {
			this.error("Template not found");
		}

		if (flags.json) {
			this.log(formatJson(template));
			return;
		}

		this.log(`Name:      ${template.name}`);
		this.log(`Subject:   ${template.subject}`);
		this.log(`Category:  ${template.category ?? "(none)"}`);
		this.log(
			`Variables: ${(template.variables as string[]).join(", ") || "(none)"}`,
		);
		this.log(`Body:\n${template.body}`);
	}
}
