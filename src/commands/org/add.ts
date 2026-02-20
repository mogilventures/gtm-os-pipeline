import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { addOrganization } from "../../services/organizations.js";
import { formatJson } from "../../utils/output.js";

export default class OrgAdd extends BaseCommand {
	static override description = "Add a new organization";

	static override args = {
		name: Args.string({ description: "Organization name", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		domain: Flags.string({ description: "Website domain" }),
		industry: Flags.string({ description: "Industry" }),
		size: Flags.string({ description: "Company size" }),
		location: Flags.string({ description: "Location" }),
		tag: Flags.string({ description: "Tag", multiple: true }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(OrgAdd);
		const db = getDb(flags.db);

		const org = addOrganization(db, {
			name: args.name,
			domain: flags.domain,
			industry: flags.industry,
			size: flags.size,
			location: flags.location,
			tags: flags.tag,
		});

		if (flags.json) {
			this.log(formatJson(org));
		} else if (flags.quiet) {
			this.log(String(org.id));
		} else {
			this.log(`Added organization: ${org.name} (id: ${org.id})`);
		}
	}
}
