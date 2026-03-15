import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addProject } from "../../services/projects.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId, resolveOrgId } from "../../utils/resolve.js";

export default class ProjectAdd extends BaseCommand {
	static override description = "Create a new project";

	static override examples = [
		'<%= config.bin %> project:add "Acme Onboarding" --contact jane --value 50000',
	];

	static override args = {
		name: Args.string({ description: "Project name", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		deal: Flags.string({ description: "Deal name (fuzzy match)" }),
		contact: Flags.string({ description: "Contact name (fuzzy match)" }),
		org: Flags.string({ description: "Organization name (fuzzy match)" }),
		value: Flags.integer({ description: "Project value" }),
		stage: Flags.string({ description: "Delivery stage" }),
		notes: Flags.string({ description: "Notes" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ProjectAdd);
		const db = getDb(flags.db);

		let dealId: number | undefined;
		if (flags.deal) {
			const { resolveDealId } = await import("../../utils/resolve.js");
			dealId = await resolveDealId(db, flags.deal);
		}
		const contactId = flags.contact
			? (await resolveContactId(db, flags.contact)).id
			: undefined;
		const orgId = flags.org ? await resolveOrgId(db, flags.org) : undefined;

		const project = addProject(db, {
			name: args.name,
			dealId,
			contactId,
			orgId,
			value: flags.value,
			stage: flags.stage,
			notes: flags.notes,
		});

		if (flags.json) {
			this.log(formatJson(project));
		} else if (flags.quiet) {
			this.log(String(project.id));
		} else {
			this.log(
				`Added project: ${project.name} (id: ${project.id}, stage: ${project.stage})`,
			);
		}
	}
}
