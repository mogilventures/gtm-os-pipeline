import { Flags } from "@oclif/core";
import { stringify } from "csv-stringify/sync";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { listContacts } from "../services/contacts.js";

export default class Export extends BaseCommand {
	static override description = "Export contacts as CSV or JSON";

	static override examples = [
		"<%= config.bin %> export --format csv > contacts.csv",
		"<%= config.bin %> export --format json | jq",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		format: Flags.string({
			description: "Output format",
			options: ["csv", "json"],
			default: "json",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Export);
		const db = getDb(flags.db);

		const contacts = listContacts(db);

		if (flags.format === "json") {
			this.log(JSON.stringify(contacts, null, 2));
			return;
		}

		// CSV
		const rows = contacts.map((c) => ({
			id: c.id,
			name: c.name,
			email: c.email || "",
			phone: c.phone || "",
			organization: c.org_name || "",
			role: c.role || "",
			warmth: c.warmth || "",
			source: c.source || "",
			tags: c.tags.join(", "),
			created_at: c.created_at,
		}));

		const csv = stringify(rows, { header: true });
		this.log(csv.trimEnd());
	}
}
