import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { pipelineView } from "../../services/deals.js";
import { formatJson } from "../../utils/output.js";

export default class DealPipeline extends BaseCommand {
	static override description =
		"Show ASCII pipeline/kanban view of deals by stage";

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { flags } = await this.parse(DealPipeline);
		const db = getDb(flags.db);

		const { stages, grouped } = pipelineView(db);

		if (flags.json) {
			this.log(formatJson(grouped));
			return;
		}

		const COL_WIDTH = 24;

		// Header
		this.log(stages.map((s) => s.padEnd(COL_WIDTH)).join("│ "));
		this.log(stages.map(() => "─".repeat(COL_WIDTH)).join("┼─"));

		// Find the max number of deals in any stage
		const maxRows = Math.max(1, ...stages.map((s) => grouped[s].length));

		for (let i = 0; i < maxRows; i++) {
			const row = stages.map((s) => {
				const deal = grouped[s][i];
				if (!deal) return "".padEnd(COL_WIDTH);
				const label = `${deal.title.slice(0, 16)} $${deal.value || 0}`;
				return label.padEnd(COL_WIDTH);
			});
			this.log(row.join("│ "));
		}

		// Totals
		this.log(stages.map(() => "─".repeat(COL_WIDTH)).join("┼─"));
		const totals = stages.map((s) => {
			const total = grouped[s].reduce((sum, d) => sum + (d.value || 0), 0);
			const count = grouped[s].length;
			return `${count} deals  $${total}`.padEnd(COL_WIDTH);
		});
		this.log(totals.join("│ "));
	}
}
