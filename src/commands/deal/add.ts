import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addDeal } from "../../services/deals.js";
import { parseDate } from "../../utils/dates.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId, resolveOrgId } from "../../utils/resolve.js";

export default class DealAdd extends BaseCommand {
	static override description = "Add a new deal";

	static override examples = [
		'<%= config.bin %> deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal',
	];

	static override args = {
		title: Args.string({ description: "Deal title", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		contact: Flags.string({ description: "Contact name (fuzzy match)" }),
		org: Flags.string({ description: "Organization name (fuzzy match)" }),
		value: Flags.integer({ description: "Deal value" }),
		stage: Flags.string({ description: "Pipeline stage" }),
		priority: Flags.string({
			description: "Priority",
			options: ["low", "medium", "high"],
		}),
		"expected-close": Flags.string({ description: "Expected close date" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(DealAdd);
		const db = getDb(flags.db);

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;
		const orgId = flags.org ? await resolveOrgId(db, flags.org) : undefined;

		const deal = addDeal(db, {
			title: args.title,
			contactId,
			orgId,
			value: flags.value,
			stage: flags.stage,
			priority: flags.priority,
			expectedClose: flags["expected-close"]
				? parseDate(flags["expected-close"])
				: undefined,
		});

		if (flags.json) {
			this.log(formatJson(deal));
		} else if (flags.quiet) {
			this.log(String(deal.id));
		} else {
			this.log(
				`Added deal: ${deal.title} (id: ${deal.id}, stage: ${deal.stage})`,
			);
		}
	}
}
