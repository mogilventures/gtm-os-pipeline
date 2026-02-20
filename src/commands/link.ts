import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { createEdge, resolveEntity } from "../services/graph.js";

export default class Link extends BaseCommand {
	static override description = "Create a relationship between entities";

	static override examples = [
		'<%= config.bin %> link jane --works-at "Acme Corp"',
		'<%= config.bin %> link jane --relation "advisor_to" acme',
	];

	static override args = {
		entity: Args.string({ description: "Source entity (person, org, or deal name)", required: true }),
		target: Args.string({ description: "Target entity (for --relation)" }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		"works-at": Flags.string({ description: "Organization the entity works at" }),
		"introduced-by": Flags.string({ description: "Person who introduced this entity" }),
		"referred-by": Flags.string({ description: "Person who referred this entity" }),
		"co-founder-of": Flags.string({ description: "Organization this person co-founded" }),
		relation: Flags.string({ description: "Custom relation type" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Link);
		const db = getDb(flags.db);

		const from = resolveEntity(db, args.entity);
		if (!from) {
			this.error(`Could not find entity matching "${args.entity}"`);
			return;
		}

		// Determine relation and target
		const relationMap: Record<string, string | undefined> = {
			"works-at": flags["works-at"],
			"introduced-by": flags["introduced-by"],
			"referred-by": flags["referred-by"],
			"co-founder-of": flags["co-founder-of"],
		};

		let relation: string | undefined;
		let targetName: string | undefined;

		for (const [rel, val] of Object.entries(relationMap)) {
			if (val) {
				relation = rel.replace(/-/g, "_");
				targetName = val;
				break;
			}
		}

		// Custom relation
		if (flags.relation && args.target) {
			relation = flags.relation;
			targetName = args.target;
		}

		if (!relation || !targetName) {
			this.error(
				"Specify a relationship flag (--works-at, --introduced-by, --referred-by, --co-founder-of) or --relation with a target",
			);
			return;
		}

		const to = resolveEntity(db, targetName);
		if (!to) {
			this.error(`Could not find entity matching "${targetName}"`);
			return;
		}

		createEdge(db, from.type, from.id, to.type, to.id, relation);
		this.log(`Linked: ${from.name} --[${relation}]--> ${to.name}`);
	}
}
