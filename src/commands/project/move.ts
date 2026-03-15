import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getProjectsForFuzzy, moveProject } from "../../services/projects.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class ProjectMove extends BaseCommand {
	static override description = "Move a project to a new delivery stage";

	static override args = {
		name: Args.string({
			description: "Project name (fuzzy match)",
			required: true,
		}),
		stage: Args.string({ description: "Target stage", required: true }),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ProjectMove);
		const db = getDb(flags.db);

		const projects = getProjectsForFuzzy(db);
		const match = await fuzzyResolve(projects, args.name, "project");

		moveProject(db, match.id, args.stage);
		this.log(`Moved "${match.name}" to stage: ${args.stage}`);
	}
}
