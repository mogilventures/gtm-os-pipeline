import { Args } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { getRelated, resolveEntity } from "../services/graph.js";
import { formatJson } from "../utils/output.js";

export default class Related extends BaseCommand {
	static override description = "Show all entities related to a given entity";

	static override examples = ["<%= config.bin %> related jane"];

	static override args = {
		entity: Args.string({
			description: "Entity name (person, org, or deal)",
			required: true,
		}),
	};

	static override flags = { ...BaseCommand.baseFlags };

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Related);
		const db = getDb(flags.db);

		const entity = resolveEntity(db, args.entity);
		if (!entity) {
			this.error(`Could not find entity matching "${args.entity}"`);
			return;
		}

		const related = getRelated(db, entity);

		if (flags.json) {
			this.log(formatJson({ entity, related }));
			return;
		}

		this.log(`Related to ${entity.name} (${entity.type}):`);

		if (related.contacts.length > 0) {
			this.log(`\n  Contacts:`);
			for (const c of related.contacts) {
				this.log(`    - ${c.name}${c.role ? ` (${c.role})` : ""}`);
			}
		}

		if (related.organizations.length > 0) {
			this.log(`\n  Organizations:`);
			for (const o of related.organizations) {
				this.log(`    - ${o.name}`);
			}
		}

		if (related.deals.length > 0) {
			this.log(`\n  Deals:`);
			for (const d of related.deals) {
				this.log(`    - ${d.title} (${d.stage})`);
			}
		}

		if (related.interactions.length > 0) {
			this.log(`\n  Interactions:`);
			for (const i of related.interactions) {
				this.log(
					`    - [${i.type}] ${i.subject || "(no subject)"} (${i.occurred_at})`,
				);
			}
		}

		if (related.tasks.length > 0) {
			this.log(`\n  Tasks:`);
			for (const t of related.tasks) {
				this.log(`    - ${t.title}${t.due ? ` (due: ${t.due})` : ""}`);
			}
		}

		if (related.edges.length > 0) {
			this.log(`\n  Edges:`);
			for (const e of related.edges) {
				const direction =
					e.from_type === entity.type && e.from_id === entity.id
						? `--[${e.relation}]--> ${e.to_type}:${e.to_id}`
						: `<--[${e.relation}]-- ${e.from_type}:${e.from_id}`;
				this.log(`    - ${direction}`);
			}
		}
	}
}
