import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import {
	editOrganization,
	getOrgsForFuzzy,
} from "../../services/organizations.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";

export default class OrgEdit extends BaseCommand {
	static override description = "Edit an organization";

	static override args = {
		name: Args.string({
			description: "Organization name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		domain: Flags.string({ description: "New domain" }),
		industry: Flags.string({ description: "New industry" }),
		size: Flags.string({ description: "New size" }),
		location: Flags.string({ description: "New location" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(OrgEdit);
		const db = getDb(flags.db);

		const orgs = getOrgsForFuzzy(db);
		const match = await fuzzyResolve(orgs, args.name, "organization");

		editOrganization(db, match.id, {
			domain: flags.domain,
			industry: flags.industry,
			size: flags.size,
			location: flags.location,
		});

		this.log(`Updated organization: ${match.name}`);
	}
}
