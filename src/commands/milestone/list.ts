import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	getProjectsForFuzzy,
	listMilestones,
} from "../../services/projects.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class MilestoneList extends BaseCommand {
	static override description = "List milestones";

	static override flags = {
		...BaseCommand.baseFlags,
		project: Flags.string({ description: "Filter by project (fuzzy match)" }),
		overdue: Flags.boolean({ description: "Show only overdue milestones" }),
		upcoming: Flags.boolean({
			description: "Show milestones due within 7 days",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(MilestoneList);
		const db = getDb(flags.db);

		let projectId: number | undefined;
		if (flags.project) {
			const projects = getProjectsForFuzzy(db);
			const match = await fuzzyResolve(projects, flags.project, "project");
			projectId = match.id;
		}

		const milestones = listMilestones(db, {
			projectId,
			overdue: flags.overdue,
			upcoming: flags.upcoming,
		});

		if (flags.json) {
			this.log(formatJson(milestones));
			return;
		}
		if (flags.quiet) {
			this.log(milestones.map((m) => m.id).join("\n"));
			return;
		}
		if (milestones.length === 0) {
			this.log("No milestones found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Title", "Project", "Due", "Done"],
				milestones.map((m) => [
					m.id,
					m.title,
					m.project_name,
					m.due ?? "",
					m.completed ? "yes" : "no",
				]),
			),
		);
	}
}
