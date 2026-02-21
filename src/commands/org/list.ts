import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { listOrganizations } from "../../services/organizations.js";
import { formatJson, formatTable } from "../../utils/output.js";

export default class OrgList extends BaseCommand {
	static override description = "List organizations";

	static override flags = {
		...BaseCommand.baseFlags,
		industry: Flags.string({ description: "Filter by industry" }),
		tag: Flags.string({ description: "Filter by tag" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(OrgList);
		const db = getDb(flags.db);

		const orgs = listOrganizations(db, {
			industry: flags.industry,
			tag: flags.tag,
		});

		if (flags.json) {
			this.log(formatJson(orgs));
			return;
		}
		if (flags.quiet) {
			this.log(orgs.map((o) => o.id).join("\n"));
			return;
		}
		if (orgs.length === 0) {
			this.log("No organizations found.");
			return;
		}

		this.log(
			formatTable(
				["ID", "Name", "Domain", "Industry", "Size", "Location"],
				orgs.map((o) => [
					o.id,
					o.name,
					o.domain,
					o.industry,
					o.size,
					o.location,
				]),
			),
		);
	}
}
