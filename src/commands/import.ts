import { readFileSync } from "node:fs";
import { Args, Flags } from "@oclif/core";
import { parse } from "csv-parse/sync";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { importCustomFields } from "../utils/custom-fields-io.js";
import {
	type EntityType,
	getImportHandler,
	getMappedValue,
	normalizeColumn,
} from "../utils/import-handlers.js";
import { stripBom } from "../utils/validation.js";

export default class Import extends BaseCommand {
	static override description = "Import records from a CSV file";

	static override examples = [
		"<%= config.bin %> import contacts.csv",
		"<%= config.bin %> import orgs.csv --type organizations",
		"<%= config.bin %> import deals.csv --type deals",
	];

	static override args = {
		file: Args.string({ description: "CSV file path", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		type: Flags.string({
			description: "Entity type to import",
			options: ["contacts", "organizations", "deals", "interactions", "tasks"],
			default: "contacts",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Import);
		const db = getDb(flags.db);
		const entityType = flags.type as EntityType;
		const handler = getImportHandler(entityType);

		const rawContent = readFileSync(args.file, "utf-8");
		const content = stripBom(rawContent);
		const records = parse(content, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
			relax_column_count: true,
		}) as Record<string, string>[];

		if (records.length === 0) {
			this.log("No records found in CSV.");
			return;
		}

		// Detect and map columns
		const rawColumns = Object.keys(records[0]);
		const columnMapping: Record<string, string> = {};
		for (const col of rawColumns) {
			columnMapping[col] = normalizeColumn(col, handler.columnMap);
		}

		// Preview
		this.log(
			`Found ${records.length} records with columns: ${rawColumns.join(", ")}`,
		);
		this.log(`Column mapping: ${JSON.stringify(columnMapping, null, 2)}`);
		this.log("\nPreview (first 5 rows):");
		for (const row of records.slice(0, 5)) {
			this.log(`  ${handler.previewRow(row, columnMapping)}`);
		}

		// Import
		let imported = 0;
		let skipped = 0;
		const errors: string[] = [];

		for (let i = 0; i < records.length; i++) {
			const row = records[i];
			try {
				const entityId = handler.importRow(db, row, columnMapping);
				importCustomFields(db, entityType, entityId, row, columnMapping);
				imported++;
			} catch (error) {
				skipped++;
				const msg = `Row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`;
				errors.push(msg);
				if (flags.verbose) {
					this.log(`  Skipped: ${msg}`);
				}
			}
		}

		this.log(`\nImported: ${imported}, Skipped: ${skipped}`);
		if (errors.length > 0 && !flags.verbose) {
			this.log(`Use -v to see ${errors.length} error(s)`);
		}
	}
}
