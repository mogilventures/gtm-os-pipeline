import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listProjects } from "../../services/projects.js";
import { formatJson, formatTable } from "../../utils/output.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class ProjectList extends BaseCommand {
	static override description = "List projects";

	static override flags = {
		...BaseCommand.baseFlags,
		stage: Flags.string({ description: "Filter by delivery stage" }),
		contact: Flags.string({ description: "Filter by contact (fuzzy match)" }),
		active: Flags.boolean({
			description: "Show only active projects",
			default: true,
			allowNo: true,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ProjectList);
		const db = getDb(flags.db);

		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;

		const projects = listProjects(db, {
			stage: flags.stage,
			contactId,
			active: flags.active,
		});

		if (flags.json) {
			this.log(formatJson(projects));
			return;
		}
		if (flags.quiet) {
			this.log(projects.map((p) => p.id).join("\n"));
			return;
		}
		if (projects.length === 0) {
			this.log("No projects found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Name", "Stage", "Contact", "Value", "Milestones"],
				projects.map((p) => [
					p.id,
					p.name,
					p.stage,
					p.contact_name,
					p.value ? `$${p.value}` : "",
					`${p.milestones_complete}/${p.milestones_total}`,
				]),
			),
		);
	}
}
