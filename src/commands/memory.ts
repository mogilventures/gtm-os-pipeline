import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { recallMemory } from "../services/agent-memory.js";
import { formatJson } from "../utils/output.js";

export default class Memory extends BaseCommand {
	static override description =
		"Inspect agent memory (past proposals and outcomes)";

	static override examples = [
		"<%= config.bin %> memory",
		"<%= config.bin %> memory --agent follow-up",
		"<%= config.bin %> memory --outcome rejected",
		"<%= config.bin %> memory --limit 5 --json",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		agent: Flags.string({ description: "Filter by agent name" }),
		contact: Flags.integer({ description: "Filter by contact ID" }),
		deal: Flags.integer({ description: "Filter by deal ID" }),
		outcome: Flags.string({
			description: "Filter by outcome (pending/approved/rejected)",
		}),
		limit: Flags.integer({
			description: "Max memories to show",
			default: 20,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Memory);
		const db = getDb(flags.db);

		const memories = recallMemory(db, {
			agentName: flags.agent,
			contactId: flags.contact,
			dealId: flags.deal,
			outcome: flags.outcome,
			limit: flags.limit,
		});

		if (memories.length === 0) {
			this.log("No agent memories found.");
			return;
		}

		if (flags.json) {
			this.log(formatJson(memories));
			return;
		}

		for (const mem of memories) {
			const outcomeIcon =
				mem.outcome === "approved"
					? "OK"
					: mem.outcome === "rejected"
						? "NO"
						: "..";
			this.log(
				`[${outcomeIcon}] #${mem.id} ${mem.agent_name} — ${mem.action_type}`,
			);
			if (mem.reasoning) {
				this.log(`  Reasoning: ${mem.reasoning}`);
			}
			if (mem.human_feedback) {
				this.log(`  Feedback: ${mem.human_feedback}`);
			}
			this.log(`  ${mem.created_at}`);
			this.log("");
		}
	}
}
