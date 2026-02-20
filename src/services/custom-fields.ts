import { and, eq } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

const VALID_ENTITY_TYPES = ["contact", "deal", "organization"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];

export function validateEntityType(type: string): EntityType {
	if (!VALID_ENTITY_TYPES.includes(type as EntityType)) {
		throw new Error(
			`Invalid entity type "${type}". Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
		);
	}
	return type as EntityType;
}

function validateEntityExists(
	db: PipelineDB,
	entityType: EntityType,
	entityId: number,
): void {
	let exists: unknown;
	switch (entityType) {
		case "contact":
			exists = db
				.select({ id: schema.contacts.id })
				.from(schema.contacts)
				.where(eq(schema.contacts.id, entityId))
				.get();
			break;
		case "deal":
			exists = db
				.select({ id: schema.deals.id })
				.from(schema.deals)
				.where(eq(schema.deals.id, entityId))
				.get();
			break;
		case "organization":
			exists = db
				.select({ id: schema.organizations.id })
				.from(schema.organizations)
				.where(eq(schema.organizations.id, entityId))
				.get();
			break;
	}
	if (!exists) {
		throw new Error(`${entityType} with id ${entityId} not found`);
	}
}

export function setField(
	db: PipelineDB,
	entityType: string,
	entityId: number,
	name: string,
	value: string,
) {
	const type = validateEntityType(entityType);
	validateEntityExists(db, type, entityId);

	const now = new Date().toISOString();
	const existing = db
		.select()
		.from(schema.customFields)
		.where(
			and(
				eq(schema.customFields.entity_type, type),
				eq(schema.customFields.entity_id, entityId),
				eq(schema.customFields.field_name, name),
			),
		)
		.get();

	if (existing) {
		db.update(schema.customFields)
			.set({ field_value: value, updated_at: now })
			.where(eq(schema.customFields.id, existing.id))
			.run();
		return { ...existing, field_value: value, updated_at: now };
	}

	return db
		.insert(schema.customFields)
		.values({
			entity_type: type,
			entity_id: entityId,
			field_name: name,
			field_value: value,
		})
		.returning()
		.get();
}

export function getFields(
	db: PipelineDB,
	entityType: string,
	entityId: number,
) {
	const type = validateEntityType(entityType);
	return db
		.select()
		.from(schema.customFields)
		.where(
			and(
				eq(schema.customFields.entity_type, type),
				eq(schema.customFields.entity_id, entityId),
			),
		)
		.all();
}

export function getField(
	db: PipelineDB,
	entityType: string,
	entityId: number,
	name: string,
) {
	const type = validateEntityType(entityType);
	return db
		.select()
		.from(schema.customFields)
		.where(
			and(
				eq(schema.customFields.entity_type, type),
				eq(schema.customFields.entity_id, entityId),
				eq(schema.customFields.field_name, name),
			),
		)
		.get();
}

export function removeField(
	db: PipelineDB,
	entityType: string,
	entityId: number,
	name: string,
): void {
	const type = validateEntityType(entityType);
	db.delete(schema.customFields)
		.where(
			and(
				eq(schema.customFields.entity_type, type),
				eq(schema.customFields.entity_id, entityId),
				eq(schema.customFields.field_name, name),
			),
		)
		.run();
}
