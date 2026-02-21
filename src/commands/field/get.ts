import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getDb } from "../../db/index.js";
import { getField, getFields } from "../../services/custom-fields.js";
import { formatJson, formatTable } from "../../utils/output.js";
import { resolveEntity } from "./set.js";

export default class FieldGet extends BaseCommand {
	static override description = "Get custom fields for an entity";

	static override examples = [
		"<%= config.bin %> field:get contact:jane",
		"<%= config.bin %> field:get contact:jane --field lead_score",
	];

	static override args = {
		entity: Args.string({
			description: "Entity reference (e.g. contact:jane, deal:acme, org:beta)",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		field: Flags.string({
			char: "f",
			description: "Get a specific field by name",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(FieldGet);
		const db = getDb(flags.db);

		const { entityType, entityId, entityName } = await resolveEntity(
			db,
			args.entity,
		);

		if (flags.field) {
			const field = getField(db, entityType, entityId, flags.field);
			if (!field) {
				this.log(
					`No field "${flags.field}" found on ${entityType} ${entityName}`,
				);
				return;
			}

			if (flags.json) {
				this.log(formatJson(field));
			} else {
				this.log(`${field.field_name} = ${field.field_value}`);
			}
			return;
		}

		const fields = getFields(db, entityType, entityId);

		if (flags.json) {
			this.log(formatJson(fields));
			return;
		}

		if (fields.length === 0) {
			this.log(`No custom fields for ${entityType} ${entityName}`);
			return;
		}

		this.log(
			`Custom fields for ${entityType} ${entityName} (id: ${entityId}):\n`,
		);
		this.log(
			formatTable(
				["Field", "Value"],
				fields.map((f) => [f.field_name, f.field_value]),
			),
		);
		this.log(
			`\n${fields.length} custom field${fields.length === 1 ? "" : "s"}`,
		);
	}
}
