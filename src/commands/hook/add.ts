import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addHook } from "../../services/events.js";

export default class HookAdd extends BaseCommand {
	static override description =
		"Add an event hook (trigger an agent when an event occurs)";

	static override examples = [
		"<%= config.bin %> hook:add contact_added enrich",
		"<%= config.bin %> hook:add deal_stage_changed deal-manager",
		"<%= config.bin %> hook:add task_overdue task-automator",
	];

	static override args = {
		event: Args.string({
			description:
				"Event type (contact_added, deal_created, deal_stage_changed, email_received, contact_stale, task_overdue)",
			required: true,
		}),
		agent: Args.string({
			description: "Agent name to trigger",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(HookAdd);
		const db = getDb(flags.db);

		const hook = addHook(db, args.event, args.agent);

		if (flags.json) {
			this.log(JSON.stringify(hook, null, 2));
		} else {
			this.log(`Hook added: ${hook.event_type} → ${hook.agent_name}`);
		}
	}
}
