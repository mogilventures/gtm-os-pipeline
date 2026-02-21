import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listHooks } from "../../services/events.js";
import { formatJson } from "../../utils/output.js";

export default class HookList extends BaseCommand {
	static override description = "List all event hooks";

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(HookList);
		const db = getDb(flags.db);

		const hooks = listHooks(db);

		if (hooks.length === 0) {
			this.log("No event hooks configured.");
			this.log('Use "pipeline hook:add <event> <agent>" to add one.');
			return;
		}

		if (flags.json) {
			this.log(formatJson(hooks));
			return;
		}

		for (const hook of hooks) {
			const status = hook.enabled ? "ON" : "OFF";
			this.log(`[${status}] ${hook.event_type} → ${hook.agent_name}`);
		}
	}
}
