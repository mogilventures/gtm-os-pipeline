import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { searchAll } from "../services/search.js";
import { formatJson, formatTable } from "../utils/output.js";

export default class Search extends BaseCommand {
	static override description = "Search across contacts, deals, organizations, and tasks";

	static override examples = [
		'<%= config.bin %> search jane',
		'<%= config.bin %> search acme --type organization',
		'<%= config.bin %> search proposal --type deal --json',
	];

	static override args = {
		query: Args.string({ description: "Search term", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		type: Flags.string({
			char: "t",
			description: "Filter by type: contact, deal, organization, task",
		}),
		limit: Flags.integer({
			char: "l",
			description: "Max results",
			default: 20,
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Search);
		const db = getDb(flags.db);

		let { results, query } = searchAll(db, args.query);

		if (flags.type) {
			results = results.filter((r) => r.type === flags.type);
		}

		results = results.slice(0, flags.limit);

		if (flags.json) {
			this.log(formatJson({ results, query }));
			return;
		}

		if (results.length === 0) {
			this.log(`No results found for "${args.query}"`);
			return;
		}

		this.log(`Search results for "${args.query}":\n`);
		this.log(
			formatTable(
				["Type", "ID", "Name", "Detail"],
				results.map((r) => [r.type, r.id, r.name, r.detail ?? ""]),
			),
		);
		this.log(`\n${results.length} result${results.length === 1 ? "" : "s"} found`);
	}
}
