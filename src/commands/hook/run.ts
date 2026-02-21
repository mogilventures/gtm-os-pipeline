import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb, getDbPath } from "../../db/index.js";
import { processEvents, scanForTimeEvents } from "../../services/events.js";
import { getAgent } from "../../services/subagents.js";

export default class HookRun extends BaseCommand {
	static override description =
		"Process pending events and trigger hooked agents";

	static override flags = {
		...BaseCommand.baseFlags,
		scan: Flags.boolean({
			description:
				"Scan for time-based events (stale contacts, overdue tasks) before processing",
			default: true,
			allowNo: true,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(HookRun);
		const db = getDb(flags.db);
		const dbPath = getDbPath(flags.db);

		// Optionally scan for time-based events first
		if (flags.scan) {
			const scanned = scanForTimeEvents(db);
			if (scanned > 0 && flags.verbose) {
				this.log(`Scanned: ${scanned} new time-based event(s)`);
			}
		}

		// Process events and collect triggers
		const results = processEvents(db);

		if (results.length === 0) {
			this.log("No events to process.");
			return;
		}

		if (flags.json) {
			this.log(JSON.stringify(results, null, 2));
			return;
		}

		// Run triggered agents
		const { runAgent } = await import("../../services/agent-runner.js");
		const triggered = new Set<string>();

		for (const r of results) {
			if (r.status !== "triggered") continue;
			// Deduplicate: only run each agent once per hook:run invocation
			if (triggered.has(r.agentName)) continue;
			triggered.add(r.agentName);

			const agent = getAgent(r.agentName);
			if (!agent) {
				this.log(`Agent "${r.agentName}" not found — skipping`);
				continue;
			}

			this.log(`Triggering ${r.agentName} (event: ${r.eventType})...`);

			try {
				await runAgent({
					prompt: `Triggered by event: ${r.eventType}. Review and act as appropriate.`,
					systemPrompt: agent.prompt,
					dbPath,
					verbose: flags.verbose,
					agentName: r.agentName,
					onText: (text) => {
						if (flags.verbose) this.log(text);
					},
				});
				this.log(`  ${r.agentName}: done`);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				this.log(`  ${r.agentName}: failed — ${msg}`);
			}
		}
	}
}
