import { Args, Flags } from "@oclif/core";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { BaseCommand } from "../base-command.js";
import { getDb } from "../db/index.js";
import { addContact } from "../services/contacts.js";

// Common column name mappings
const COLUMN_MAP: Record<string, string> = {
	"full name": "name",
	"first name": "first_name",
	"last name": "last_name",
	"first": "first_name",
	"last": "last_name",
	"email": "email",
	"email address": "email",
	"e-mail": "email",
	"phone": "phone",
	"phone number": "phone",
	"company": "org",
	"organization": "org",
	"organisation": "org",
	"company name": "org",
	"role": "role",
	"title": "role",
	"job title": "role",
	"position": "role",
	"source": "source",
	"tags": "tags",
	"tag": "tags",
	"linkedin": "linkedin",
	"linkedin url": "linkedin",
};

function normalizeColumn(col: string): string {
	const lower = col.toLowerCase().trim();
	return COLUMN_MAP[lower] || lower;
}

export default class Import extends BaseCommand {
	static override description = "Import contacts from a CSV file";

	static override examples = [
		"<%= config.bin %> import contacts.csv",
	];

	static override args = {
		file: Args.string({ description: "CSV file path", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Import);
		const db = getDb(flags.db);

		const content = readFileSync(args.file, "utf-8");
		const records = parse(content, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		}) as Record<string, string>[];

		if (records.length === 0) {
			this.log("No records found in CSV.");
			return;
		}

		// Detect and map columns
		const rawColumns = Object.keys(records[0]);
		const columnMapping: Record<string, string> = {};
		for (const col of rawColumns) {
			columnMapping[col] = normalizeColumn(col);
		}

		// Preview
		this.log(`Found ${records.length} records with columns: ${rawColumns.join(", ")}`);
		this.log(`Column mapping: ${JSON.stringify(columnMapping, null, 2)}`);
		this.log("\nPreview (first 5 rows):");
		for (const row of records.slice(0, 5)) {
			const name = getMappedValue(row, columnMapping, "name")
				|| `${getMappedValue(row, columnMapping, "first_name") || ""} ${getMappedValue(row, columnMapping, "last_name") || ""}`.trim();
			const email = getMappedValue(row, columnMapping, "email");
			this.log(`  ${name || "(no name)"} <${email || "no email"}>`);
		}

		// Import
		let imported = 0;
		let skipped = 0;

		for (const row of records) {
			const name = getMappedValue(row, columnMapping, "name")
				|| `${getMappedValue(row, columnMapping, "first_name") || ""} ${getMappedValue(row, columnMapping, "last_name") || ""}`.trim();

			if (!name) {
				skipped++;
				continue;
			}

			try {
				addContact(db, {
					name,
					email: getMappedValue(row, columnMapping, "email") || undefined,
					phone: getMappedValue(row, columnMapping, "phone") || undefined,
					linkedin: getMappedValue(row, columnMapping, "linkedin") || undefined,
					org: getMappedValue(row, columnMapping, "org") || undefined,
					role: getMappedValue(row, columnMapping, "role") || undefined,
					source: getMappedValue(row, columnMapping, "source") || undefined,
					tags: getMappedValue(row, columnMapping, "tags")?.split(",").map((t) => t.trim()).filter(Boolean),
				});
				imported++;
			} catch (error) {
				skipped++;
				if (flags.verbose) {
					this.log(`  Skipped "${name}": ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}

		this.log(`\nImported: ${imported}, Skipped: ${skipped}`);
	}
}

function getMappedValue(
	row: Record<string, string>,
	mapping: Record<string, string>,
	targetField: string,
): string | null {
	for (const [rawCol, mappedCol] of Object.entries(mapping)) {
		if (mappedCol === targetField && row[rawCol]) {
			return row[rawCol];
		}
	}
	return null;
}
