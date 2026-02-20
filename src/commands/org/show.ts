import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getFields } from "../../services/custom-fields.js";
import { getOrgsForFuzzy, showOrganization } from "../../services/organizations.js";
import { fuzzyResolve } from "../../utils/fuzzy.js";
import { formatJson } from "../../utils/output.js";

export default class OrgShow extends BaseCommand {
	static override description = "Show organization details";

	static override args = {
		name: Args.string({ description: "Organization name (fuzzy match)", required: true }),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(OrgShow);
		const db = getDb(flags.db);

		const orgs = getOrgsForFuzzy(db);
		const match = await fuzzyResolve(orgs, args.name, "organization");
		const detail = showOrganization(db, match.id);

		if (!detail) {
			this.error("Organization not found");
			return;
		}

		if (flags.json) {
			this.log(formatJson(detail));
			return;
		}

		this.log(`Organization: ${detail.name}`);
		this.log(`  ID:       ${detail.id}`);
		if (detail.domain) this.log(`  Domain:   ${detail.domain}`);
		if (detail.industry) this.log(`  Industry: ${detail.industry}`);
		if (detail.size) this.log(`  Size:     ${detail.size}`);
		if (detail.location) this.log(`  Location: ${detail.location}`);
		if (detail.tags.length > 0) this.log(`  Tags:     ${detail.tags.join(", ")}`);

		if (detail.contacts.length > 0) {
			this.log(`\n  Contacts (${detail.contacts.length}):`);
			for (const c of detail.contacts) {
				this.log(`    - ${c.name} (${c.role || "no role"}) ${c.email || ""}`);
			}
		}

		if (detail.deals.length > 0) {
			this.log(`\n  Deals (${detail.deals.length}):`);
			for (const d of detail.deals) {
				this.log(`    - ${d.title} (${d.stage}, $${d.value || 0})`);
			}
		}

		const customFields = getFields(db, "organization", detail.id);
		if (customFields.length > 0) {
			this.log(`\n  Custom Fields (${customFields.length}):`);
			for (const f of customFields) {
				this.log(`    ${f.field_name}: ${f.field_value}`);
			}
		}
	}
}
