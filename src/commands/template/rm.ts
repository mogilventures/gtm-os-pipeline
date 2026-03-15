import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	getTemplatesForFuzzy,
	removeTemplate,
} from "../../services/email-templates.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class TemplateRm extends BaseCommand {
	static override description = "Remove an email template";

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
		const { args, flags } = await this.parse(TemplateRm);
		const db = getDb(flags.db);

		const templates = getTemplatesForFuzzy(db);
		const match = await fuzzyResolve(templates, args.name, "template");

		removeTemplate(db, match.id);
		this.log(`Removed template: ${match.name}`);
	}
}
