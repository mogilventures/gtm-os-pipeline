import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { showContact } from "../../services/contacts.js";
import { getFields } from "../../services/custom-fields.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId } from "../../utils/resolve.js";

export default class ContactShow extends BaseCommand {
	static override description = "Show contact details";

	static override args = {
		name: Args.string({
			description: "Contact name (fuzzy match)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(ContactShow);
		const db = getDb(flags.db);

		const match = await resolveContactId(db, args.name);
		const detail = showContact(db, match.id);

		if (!detail) {
			this.error("Contact not found");
		}

		if (flags.json) {
			this.log(formatJson(detail));
			return;
		}

		this.log(`Contact: ${detail.name}`);
		this.log(`  ID:      ${detail.id}`);
		if (detail.email) this.log(`  Email:   ${detail.email}`);
		if (detail.phone) this.log(`  Phone:   ${detail.phone}`);
		if (detail.org_name) this.log(`  Org:     ${detail.org_name}`);
		if (detail.role) this.log(`  Role:    ${detail.role}`);
		this.log(`  Warmth:  ${detail.warmth}`);
		if (detail.tags.length > 0)
			this.log(`  Tags:    ${detail.tags.join(", ")}`);

		if (detail.interactions.length > 0) {
			this.log(`\n  Interactions (${detail.interactions.length}):`);
			for (const i of detail.interactions.slice(0, 5)) {
				this.log(
					`    - [${i.type}] ${i.subject || i.body || "(no subject)"} (${i.occurred_at})`,
				);
			}
		}

		if (detail.deals.length > 0) {
			this.log(`\n  Deals (${detail.deals.length}):`);
			for (const d of detail.deals) {
				this.log(`    - ${d.title} (${d.stage}, $${d.value || 0})`);
			}
		}

		if (detail.tasks.length > 0) {
			this.log(`\n  Tasks (${detail.tasks.length}):`);
			for (const t of detail.tasks) {
				const status = t.completed ? "done" : "open";
				this.log(
					`    - [${status}] ${t.title}${t.due ? ` (due: ${t.due})` : ""}`,
				);
			}
		}

		const customFields = getFields(db, "contact", detail.id);
		if (customFields.length > 0) {
			this.log(`\n  Custom Fields (${customFields.length}):`);
			for (const f of customFields) {
				this.log(`    ${f.field_name}: ${f.field_value}`);
			}
		}
	}
}
