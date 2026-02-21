import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { logInteraction } from "../../services/interactions.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class LogCall extends BaseCommand {
	static override description = "Log a call interaction";

	static override args = {
		contact: Args.string({
			description: "Contact name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		direction: Flags.string({
			description: "Direction",
			options: ["inbound", "outbound"],
			default: "outbound",
		}),
		body: Flags.string({ description: "Call notes" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(LogCall);
		const db = getDb(flags.db);

		const match = await resolveContactId(db, args.contact);

		const interaction = logInteraction(db, {
			contactId: match.id,
			type: "call",
			direction: flags.direction,
			body: flags.body,
		});

		this.log(`Logged call with ${match.name} (id: ${interaction.id})`);
	}
}
