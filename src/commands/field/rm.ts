import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { removeField } from "../../services/custom-fields.js";
import { resolveEntity } from "./set.js";

export default class FieldRm extends BaseCommand {
	static override description = "Remove a custom field from an entity";

	static override examples = [
		"<%= config.bin %> field:rm contact:jane industry_focus",
		"<%= config.bin %> field:rm deal:acme priority_score",
	];

	static override args = {
		entity: Args.string({
			description: "Entity reference (e.g. contact:jane, deal:acme, org:beta)",
			required: true,
		}),
		field_name: Args.string({
			description: "Field name to remove",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(FieldRm);
		const db = getDb(flags.db);

		const { entityType, entityId, entityName } = await resolveEntity(db, args.entity);
		removeField(db, entityType, entityId, args.field_name);

		if (flags.json) {
			this.log(JSON.stringify({ removed: args.field_name, entityType, entityId }));
		} else if (!flags.quiet) {
			this.log(
				`Removed field "${args.field_name}" from ${entityType} ${entityName} (id: ${entityId})`,
			);
		}
	}
}
