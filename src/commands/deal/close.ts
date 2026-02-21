import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { closeDeal, getDealsForFuzzy } from "../../services/deals.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class DealClose extends BaseCommand {
	static override description = "Close a deal as won or lost";

	static override args = {
		name: Args.string({
			description: "Deal name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		won: Flags.boolean({ description: "Mark as won", exclusive: ["lost"] }),
		lost: Flags.boolean({ description: "Mark as lost", exclusive: ["won"] }),
		reason: Flags.string({ description: "Close reason" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(DealClose);
		const db = getDb(flags.db);

		if (!flags.won && !flags.lost) {
			this.error("Specify --won or --lost");
		}

		const deals = getDealsForFuzzy(db);
		const match = await fuzzyResolve(deals, args.name, "deal");

		const won = flags.won === true;
		closeDeal(db, match.id, won, flags.reason);
		this.log(`Closed "${match.name}" as ${won ? "won" : "lost"}`);
	}
}
