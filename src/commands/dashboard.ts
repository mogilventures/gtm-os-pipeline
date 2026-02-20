import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { getDashboard } from "../services/dashboard.js";
import { formatJson } from "../utils/output.js";

export default class Dashboard extends BaseCommand {
	static override description = "Show pipeline dashboard summary";

	static override examples = [
		"<%= config.bin %> dashboard",
		"<%= config.bin %> dashboard --json",
	];

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Dashboard);
		const db = getDb(flags.db);

		const data = getDashboard(db);

		if (flags.json) {
			this.log(formatJson(data));
			return;
		}

		this.log("Pipeline Dashboard");
		this.log("=".repeat(50));

		// Pipeline value
		const openDealCount = Object.values(data.dealsByStage).reduce(
			(sum, s) => sum + s.count,
			0,
		);
		this.log(
			`\nPipeline Value: $${data.pipelineValue.toLocaleString()} across ${openDealCount} open deal${openDealCount === 1 ? "" : "s"}`,
		);

		// Deals by stage
		const stages = Object.entries(data.dealsByStage);
		if (stages.length > 0) {
			this.log("\nDeals by Stage:");
			for (const [stage, info] of stages) {
				this.log(
					`  ${stage.padEnd(18)} ${info.count} deal${info.count === 1 ? " " : "s"}   $${info.value.toLocaleString()}`,
				);
			}
		}

		// Closing soon
		if (data.closingSoon.length > 0) {
			this.log(`\nClosing This Week (${data.closingSoon.length}):`);
			for (const d of data.closingSoon) {
				const value = d.value ? `$${d.value.toLocaleString()}` : "no value";
				this.log(
					`  ${d.title.padEnd(22)} ${value.padEnd(12)} closes ${d.expected_close ?? "unknown"}`,
				);
			}
		}

		// Overdue tasks
		if (data.overdueTasks.length > 0) {
			this.log(`\nOverdue Tasks (${data.overdueTasks.length}):`);
			for (const t of data.overdueTasks.slice(0, 5)) {
				const contact = t.contact_name ? `   ${t.contact_name}` : "";
				this.log(`  ${t.title.padEnd(28)} due ${t.due}${contact}`);
			}
			if (data.overdueTasks.length > 5) {
				this.log(`  ... and ${data.overdueTasks.length - 5} more`);
			}
		}

		// Tasks due today
		if (data.tasksDueToday.length > 0) {
			this.log(`\nTasks Due Today (${data.tasksDueToday.length}):`);
			for (const t of data.tasksDueToday) {
				const contact = t.contact_name ? `   ${t.contact_name}` : "";
				this.log(`  ${t.title}${contact}`);
			}
		}

		// Stale contacts
		if (data.staleContacts.length > 0) {
			this.log(
				`\nStale Contacts (${data.staleContacts.length} with no activity in 14d):`,
			);
			for (const c of data.staleContacts.slice(0, 5)) {
				this.log(
					`  ${c.name.padEnd(22)} last activity ${c.updated_at.split("T")[0]}`,
				);
			}
			if (data.staleContacts.length > 5) {
				this.log(`  ... and ${data.staleContacts.length - 5} more`);
			}
		}

		// Pending actions
		if (data.pendingActions > 0) {
			this.log(
				`\nPending Agent Actions: ${data.pendingActions} (run \`pipeline approve --list\` to review)`,
			);
		}

		// Recent activity
		this.log(
			`\nRecent Activity: ${data.recentActivityCount} interaction${data.recentActivityCount === 1 ? "" : "s"} in the last 7 days`,
		);
	}
}
