import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { logInteraction } from "../../services/interactions.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class LogMeeting extends BaseCommand {
	static override description = "Log a meeting interaction";

	static override args = {
		contact: Args.string({ description: "Contact name (fuzzy match)", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		body: Flags.string({ description: "Meeting notes" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(LogMeeting);
		const db = getDb(flags.db);

		const match = await resolveContactId(db, args.contact);

		const interaction = logInteraction(db, {
			contactId: match.id,
			type: "meeting",
			body: flags.body,
		});

		this.log(`Logged meeting with ${match.name} (id: ${interaction.id})`);
	}
}
