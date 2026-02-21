import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { removeEdge, resolveEntity } from "../services/graph.js";

export default class Unlink extends BaseCommand {
	static override description = "Remove a relationship between entities";

	static override args = {
		entity: Args.string({ description: "Source entity name", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		relation: Flags.string({
			description: "Relation type to remove",
			required: true,
		}),
		target: Flags.string({ description: "Target entity name", required: true }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Unlink);
		const db = getDb(flags.db);

		const from = resolveEntity(db, args.entity);
		if (!from) {
			this.error(`Could not find entity matching "${args.entity}"`);
			return;
		}

		const to = resolveEntity(db, flags.target);
		if (!to) {
			this.error(`Could not find entity matching "${flags.target}"`);
			return;
		}

		removeEdge(db, from.type, from.id, to.type, to.id, flags.relation);
		this.log(`Unlinked: ${from.name} --[${flags.relation}]--> ${to.name}`);
	}
}
