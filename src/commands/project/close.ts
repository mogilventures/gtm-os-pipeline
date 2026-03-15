import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { closeProject, getProjectsForFuzzy } from "../../services/projects.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class ProjectClose extends BaseCommand {
	static override description = "Mark a project as complete";

	static override args = {
		name: Args.string({
			description: "Project name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ProjectClose);
		const db = getDb(flags.db);

		const projects = getProjectsForFuzzy(db);
		const match = await fuzzyResolve(projects, args.name, "project");

		closeProject(db, match.id);
		this.log(`Closed project: ${match.name}`);
	}
}
