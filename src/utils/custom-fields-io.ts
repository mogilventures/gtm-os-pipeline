import { eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { setField, getFields } from "../services/custom-fields.js";
import type { EntityType } from "./import-handlers.js";

export const CF_PREFIX = "cf:";

/** Import/export uses plural ("contacts"), custom-fields service uses singular ("contact"). */
const ENTITY_TYPE_MAP: Partial<Record<EntityType, string>> = {
	contacts: "contact",
	organizations: "organization",
	deals: "deal",
};

/** Get all custom field values for one entity row, keyed as "cf:fieldName". */
export function getCustomFieldColumns(
	db: PipelineDB,
	entityType: EntityType,
	entityId: number,
): Record<string, string> {
	const cfType = ENTITY_TYPE_MAP[entityType];
	if (!cfType) return {};

	const fields = getFields(db, cfType, entityId);
	const result: Record<string, string> = {};
	for (const f of fields) {
		result[`${CF_PREFIX}${f.field_name}`] = f.field_value ?? "";
	}
	return result;
}

/** Get all distinct custom field names for an entity type (for consistent CSV columns). */
export function getAllCustomFieldNames(
	db: PipelineDB,
	entityType: EntityType,
): string[] {
	const cfType = ENTITY_TYPE_MAP[entityType];
	if (!cfType) return [];

	const rows = db
		.select({ field_name: schema.customFields.field_name })
		.from(schema.customFields)
		.where(eq(schema.customFields.entity_type, cfType))
		.all();

	const names = new Set<string>();
	for (const r of rows) {
		names.add(r.field_name);
	}
	return [...names].sort();
}

/** After importing a row, detect any cf:* mapped columns and save them. */
export function importCustomFields(
	db: PipelineDB,
	entityType: EntityType,
	entityId: number,
	row: Record<string, string>,
	mapping: Record<string, string>,
): void {
	const cfType = ENTITY_TYPE_MAP[entityType];
	if (!cfType) return;

	for (const [rawCol, mappedCol] of Object.entries(mapping)) {
		if (mappedCol.startsWith(CF_PREFIX)) {
			const value = row[rawCol];
			if (value && value.trim()) {
				const fieldName = mappedCol.slice(CF_PREFIX.length);
				setField(db, cfType, entityId, fieldName, value.trim());
			}
		}
	}
}
