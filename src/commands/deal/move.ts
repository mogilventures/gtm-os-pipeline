import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getDealsForFuzzy, moveDeal } from "../../services/deals.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class DealMove extends BaseCommand {
	static override description = "Move a deal to a new stage";

	static override args = {
		name: Args.string({ description: "Deal name (fuzzy match)", required: true }),
		stage: Args.string({ description: "Target stage", required: true }),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(DealMove);
		const db = getDb(flags.db);

		const deals = getDealsForFuzzy(db);
		const match = await fuzzyResolve(deals, args.name, "deal");

		moveDeal(db, match.id, args.stage);
		this.log(`Moved "${match.name}" to stage: ${args.stage}`);
	}
}
