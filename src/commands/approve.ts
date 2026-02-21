import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb, type schema } from "../db/index.js";
import {
	approveAction,
	approveAll,
	listPendingActions,
	rejectAction,
} from "../services/approval.js";
import { formatJson } from "../utils/output.js";

type PendingAction = typeof schema.pendingActions.$inferSelect;

export default class Approve extends BaseCommand {
	static override description = "Review and approve agent-proposed actions";

	static override examples = [
		"<%= config.bin %> approve",
		"<%= config.bin %> approve --list",
		"<%= config.bin %> approve --all",
		"<%= config.bin %> approve --reject 3",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		list: Flags.boolean({ description: "List pending actions without acting" }),
		all: Flags.boolean({ description: "Approve all pending actions" }),
		reject: Flags.integer({ description: "Reject a specific action by ID" }),
	};

	private logAction(action: PendingAction): void {
		this.log(`#${action.id} [${action.action_type}]`);
		this.log(`  Reasoning: ${action.reasoning || "(none)"}`);
		if (action.payload) {
			this.log(`  Payload: ${JSON.stringify(action.payload)}`);
		}
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Approve);
		const db = getDb(flags.db);

		if (flags.reject) {
			rejectAction(db, flags.reject);
			this.log(`Rejected action #${flags.reject}`);
			return;
		}

		const pending = listPendingActions(db);

		if (pending.length === 0) {
			this.log("No pending actions.");
			return;
		}

		if (flags.list || flags.json) {
			if (flags.json) {
				this.log(formatJson(pending));
			} else {
				for (const action of pending) {
					this.logAction(action);
					this.log("");
				}
			}
			return;
		}

		if (flags.all) {
			const results = await approveAll(db);
			for (const r of results) {
				this.log(`Approved ${r}`);
			}
			return;
		}

		// Interactive mode
		if (!process.stdin.isTTY) {
			// Non-interactive: just list
			for (const action of pending) {
				this.log(
					`#${action.id} [${action.action_type}] — ${action.reasoning || "(no reasoning)"}`,
				);
			}
			this.log("\nUse --all to approve all, or --reject <id> to reject.");
			return;
		}

		const { select } = await import("@inquirer/prompts");

		for (const action of pending) {
			this.log("");
			this.logAction(action);

			const choice = await select({
				message: "Action?",
				choices: [
					{ name: "Approve", value: "approve" },
					{ name: "Reject", value: "reject" },
					{ name: "Skip", value: "skip" },
				],
			});

			if (choice === "approve") {
				const result = await approveAction(db, action.id);
				this.log(`  → ${result}`);
			} else if (choice === "reject") {
				rejectAction(db, action.id);
				this.log("  → Rejected");
			} else {
				this.log("  → Skipped");
			}
		}
	}
}
