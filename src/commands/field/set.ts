import { Args } from "@oclif/core";
import { eq } from "drizzle-orm";
import { BaseCommand } from "../../base-command.js";
import { getDb, schema } from "../../db/index.js";
import type { PipelineDB } from "../../db/index.js";
import { setField } from "../../services/custom-fields.js";
import { formatJson } from "../../utils/output.js";
import { resolveContactId, resolveDealId, resolveOrgId } from "../../utils/resolve.js";

export default class FieldSet extends BaseCommand {
	static override description = "Set a custom field on an entity";

	static override examples = [
		'<%= config.bin %> field:set contact:jane industry_focus fintech',
		'<%= config.bin %> field:set deal:acme priority_score 85',
		'<%= config.bin %> field:set org:beta sector enterprise',
	];

	static override args = {
		entity: Args.string({
			description: "Entity reference (e.g. contact:jane, deal:acme, org:beta)",
			required: true,
		}),
		field_name: Args.string({
			description: "Field name",
			required: true,
		}),
		value: Args.string({
			description: "Field value",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(FieldSet);
		const db = getDb(flags.db);

		const { entityType, entityId, entityName } = await resolveEntity(db, args.entity);
		const field = setField(db, entityType, entityId, args.field_name, args.value);

		if (flags.json) {
			this.log(formatJson(field));
		} else if (flags.quiet) {
			this.log(String(field.id));
		} else {
			this.log(
				`Set field "${args.field_name}" = "${args.value}" on ${entityType} ${entityName} (id: ${entityId})`,
			);
		}
	}
}

export async function resolveEntity(
	db: PipelineDB,
	ref: string,
): Promise<{ entityType: string; entityId: number; entityName: string }> {
	const colonIdx = ref.indexOf(":");
	if (colonIdx === -1) {
		throw new Error(
			'Entity reference must be in format "type:query" (e.g. contact:jane, deal:acme, org:beta)',
		);
	}

	const rawType = ref.slice(0, colonIdx);
	const query = ref.slice(colonIdx + 1);

	switch (rawType) {
		case "contact": {
			const match = await resolveContactId(db, query);
			return { entityType: "contact", entityId: match.id, entityName: match.name };
		}
		case "deal": {
			const dealId = await resolveDealId(db, query);
			const deal = db
				.select({ title: schema.deals.title })
				.from(schema.deals)
				.where(eq(schema.deals.id, dealId))
				.get();
			return { entityType: "deal", entityId: dealId, entityName: deal?.title ?? String(dealId) };
		}
		case "org":
		case "organization": {
			const orgId = await resolveOrgId(db, query);
			const org = db
				.select({ name: schema.organizations.name })
				.from(schema.organizations)
				.where(eq(schema.organizations.id, orgId))
				.get();
			return {
				entityType: "organization",
				entityId: orgId,
				entityName: org?.name ?? String(orgId),
			};
		}
		default:
			throw new Error(
				`Unknown entity type "${rawType}". Use contact, deal, or org.`,
			);
	}
}
