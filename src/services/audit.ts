import { desc, like, sql } from "drizzle-orm";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";

const MAX_ROWS = 500;

interface WriteAuditLogInput {
	actor: string;
	command: string;
	args?: string;
	result?: string;
	error?: string;
	duration_ms?: number;
}

export function writeAuditLog(db: PipelineDB, input: WriteAuditLogInput) {
	db.insert(schema.auditLog)
		.values({
			actor: input.actor,
			command: input.command,
			args: input.args ?? null,
			result: input.result ?? null,
			error: input.error ?? null,
			duration_ms: input.duration_ms ?? null,
		})
		.run();

	// Prune if over limit — cheap count on a small capped table
	const [{ count }] = db
		.select({ count: sql<number>`count(*)` })
		.from(schema.auditLog)
		.all();
	if (count > MAX_ROWS) {
		pruneAuditLog(db);
	}
}

export function getAuditLog(
	db: PipelineDB,
	filters?: {
		actor?: string;
		command?: string;
		last?: number;
	},
) {
	let query = db
		.select()
		.from(schema.auditLog)
		.orderBy(desc(schema.auditLog.id))
		.$dynamic();

	if (filters?.actor) {
		query = query.where(
			like(schema.auditLog.actor, `%${filters.actor}%`),
		);
	}

	if (filters?.command) {
		query = query.where(
			like(schema.auditLog.command, `%${filters.command}%`),
		);
	}

	const limit = filters?.last ?? 20;
	query = query.limit(limit);

	return query.all();
}

export function pruneAuditLog(db: PipelineDB) {
	db.run(sql`
		DELETE FROM audit_log WHERE id NOT IN (
			SELECT id FROM audit_log ORDER BY id DESC LIMIT ${MAX_ROWS}
		)
	`);
}
