import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listTemplates } from "../../services/email-templates.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class TemplateList extends BaseCommand {
	static override description = "List email templates";

	static override flags = {
		...BaseCommand.baseFlags,
		category: Flags.string({
			description: "Filter by category",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(TemplateList);
		const db = getDb(flags.db);

		const templates = listTemplates(db, {
			category: flags.category,
		});

		if (flags.json) {
			this.log(formatJson(templates));
			return;
		}

		if (templates.length === 0) {
			this.log("No templates found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Name", "Subject", "Category", "Variables"],
				templates.map((t) => [
					t.id,
					t.name,
					t.subject.length > 40 ? `${t.subject.slice(0, 37)}...` : t.subject,
					t.category,
					(t.variables as string[]).length,
				]),
			),
		);
	}
}
