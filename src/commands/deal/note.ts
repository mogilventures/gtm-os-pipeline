import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addDealNote, getDealsForFuzzy } from "../../services/deals.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class DealNote extends BaseCommand {
	static override description = "Add a note to a deal";

	static override args = {
		name: Args.string({ description: "Deal name (fuzzy match)", required: true }),
		body: Args.string({ description: "Note body", required: true }),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(DealNote);
		const db = getDb(flags.db);

		const deals = getDealsForFuzzy(db);
		const match = await fuzzyResolve(deals, args.name, "deal");

		const interaction = addDealNote(db, match.id, args.body);
		this.log(`Note added to deal "${match.name}" (interaction id: ${interaction.id})`);
	}
}
