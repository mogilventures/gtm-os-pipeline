import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addMilestone, getProjectsForFuzzy } from "../../services/projects.js";
import { parseDate } from "../../utils/dates.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class MilestoneAdd extends BaseCommand {
	static override description = "Add a milestone to a project";

	static override examples = [
		'<%= config.bin %> milestone:add "Deliver v1" --project acme --due 2026-04-01',
	];

	static override args = {
		title: Args.string({ description: "Milestone title", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		project: Flags.string({
			description: "Project name (fuzzy match)",
			required: true,
		}),
		contact: Flags.string({ description: "Contact name (fuzzy match)" }),
		due: Flags.string({ description: "Due date" }),
		description: Flags.string({ description: "Description" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(MilestoneAdd);
		const db = getDb(flags.db);

		const projects = getProjectsForFuzzy(db);
		const project = await fuzzyResolve(projects, flags.project, "project");

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;

		const milestone = addMilestone(db, {
			projectId: project.id,
			title: args.title,
			description: flags.description,
			contactId,
			due: flags.due ? parseDate(flags.due) : undefined,
		});

		if (flags.json) {
			this.log(formatJson(milestone));
		} else if (flags.quiet) {
			this.log(String(milestone.id));
		} else {
			this.log(
				`Added milestone: ${milestone.title} (id: ${milestone.id}) to project "${project.name}"`,
			);
		}
	}
}
