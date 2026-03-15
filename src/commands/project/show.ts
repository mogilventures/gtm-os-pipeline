import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getProjectsForFuzzy, showProject } from "../../services/projects.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class ProjectShow extends BaseCommand {
	static override description = "Show project details";

	static override args = {
		name: Args.string({
			description: "Project name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ProjectShow);
		const db = getDb(flags.db);

		const projects = getProjectsForFuzzy(db);
		const match = await fuzzyResolve(projects, args.name, "project");
		const detail = showProject(db, match.id);

		if (!detail) {
			this.error(`Project not found: ${args.name}`);
			return;
		}

		if (flags.json) {
			this.log(formatJson(detail));
			return;
		}

		const { project, milestones, tasks, contact, deal } = detail;

		this.log(`Project: ${project.name} (id: ${project.id})`);
		this.log(`Stage: ${project.stage}`);
		if (project.value) this.log(`Value: $${project.value}`);
		if (contact) this.log(`Contact: ${contact.name}`);
		if (deal) this.log(`Deal: ${deal.title}`);
		if (project.notes) this.log(`Notes: ${project.notes}`);
		if (project.started_at) this.log(`Started: ${project.started_at}`);
		if (project.completed_at) this.log(`Completed: ${project.completed_at}`);

		if (milestones.length > 0) {
			this.log("");
			this.log("Milestones:");
			this.log(
				formatTable(
					["ID", "Title", "Due", "Done"],
					milestones.map((m) => [
						m.id,
						m.title,
						m.due ?? "",
						m.completed ? "yes" : "no",
					]),
				),
			);
		}

		if (tasks.length > 0) {
			this.log("");
			this.log("Tasks:");
			this.log(
				formatTable(
					["ID", "Title", "Due"],
					tasks.map((t) => [t.id, t.title, t.due ?? ""]),
				),
			);
		}
	}
}
