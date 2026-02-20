import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { logInteraction } from "../../services/interactions.js";
import { resolveContactId, resolveDealId } from "../../utils/resolve.js";

export default class LogEmail extends BaseCommand {
	static override description = "Log an email interaction";

	static override args = {
		contact: Args.string({ description: "Contact name (fuzzy match)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		direction: Flags.string({
			description: "Direction",
			options: ["inbound", "outbound"],
			default: "outbound",
		}),
		subject: Flags.string({ description: "Email subject" }),
		body: Flags.string({ description: "Email body" }),
		deal: Flags.string({ description: "Related deal (fuzzy match)" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(LogEmail);
		const db = getDb(flags.db);

		const match = await resolveContactId(db, args.contact);
		const dealId = flags.deal ? await resolveDealId(db, flags.deal) : undefined;

		const interaction = logInteraction(db, {
			contactId: match.id,
			type: "email",
			direction: flags.direction,
			subject: flags.subject,
			body: flags.body,
			dealId,
		});

		this.log(`Logged email with ${match.name} (id: ${interaction.id})`);
	}
}
