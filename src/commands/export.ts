import { Flags } from "@oclif/core";
import { stringify } from "csv-stringify/sync";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import {
	CF_PREFIX,
	getAllCustomFieldNames,
	getCustomFieldColumns,
} from "../utils/custom-fields-io.js";
import { getExportHandler } from "../utils/export-handlers.js";
import type { EntityType } from "../utils/import-handlers.js";

export default class Export extends BaseCommand {
	static override description = "Export records as CSV or JSON";

	static override examples = [
		"<%= config.bin %> export --format csv > contacts.csv",
		"<%= config.bin %> export --format json | jq",
		"<%= config.bin %> export --type deals --format csv > deals.csv",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		format: Flags.string({
			description: "Output format",
			options: ["csv", "json"],
			default: "json",
		}),
		type: Flags.string({
			description: "Entity type to export",
			options: ["contacts", "organizations", "deals", "interactions", "tasks"],
			default: "contacts",
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Export);
		const db = getDb(flags.db);
		const entityType = flags.type as EntityType;
		const handler = getExportHandler(entityType);

		const rows = handler.fetchRows(db);
		const cfNames = getAllCustomFieldNames(db, entityType);

		if (flags.format === "json") {
			const jsonRows = rows.map((r) => {
				const base = { ...r };
				if (cfNames.length > 0) {
					const cfValues = getCustomFieldColumns(db, entityType, r.id);
					const customFields: Record<string, string> = {};
					for (const name of cfNames) {
						const key = `${CF_PREFIX}${name}`;
						customFields[key] = cfValues[key] || "";
					}
					base.custom_fields = customFields;
				}
				return base;
			});
			this.log(JSON.stringify(jsonRows, null, 2));
			return;
		}

		// CSV
		const csvRows = rows.map((r) => {
			const base = handler.toCsvRow(r);
			if (cfNames.length > 0) {
				const cfValues = getCustomFieldColumns(db, entityType, r.id);
				for (const name of cfNames) {
					const key = `${CF_PREFIX}${name}`;
					base[key] = cfValues[key] || "";
				}
			}
			return base;
		});
		const csv = stringify(csvRows, { header: true });
		this.log(csv.trimEnd());
	}
}
