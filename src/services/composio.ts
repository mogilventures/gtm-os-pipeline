import { eq } from "drizzle-orm";
import { loadConfig } from "../config.js";
import type { PipelineDB } from "../db/index.js";
import { schema } from "../db/index.js";
import { emitEvent } from "./events.js";

// ── Lazy Composio singleton ────────────────────────────────────

let _composio: any = null;

async function getComposio() {
	if (_composio) return _composio;
	const { Composio } = await import("@composio/core");
	const config = loadConfig();
	const apiKey =
		(config.integrations?.composio_api_key as string) ||
		process.env.COMPOSIO_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Composio API key not configured.\nSet it with: pipeline config:set integrations.composio_api_key csk_xxxx",
		);
	}
	_composio = new Composio({ apiKey });
	return _composio;
}

function getUserId(): string {
	const config = loadConfig();
	return (config.integrations?.user_id as string) || "pipeline-crm-user";
}

// ── Session (Tool Router) ──────────────────────────────────────

export async function createSession() {
	const composio = await getComposio();
	return composio.create(getUserId());
}

// ── Connect / Disconnect ───────────────────────────────────────

export async function connectToolkit(
	db: PipelineDB,
	toolkit: string,
	label?: string,
): Promise<{ redirectUrl: string | null; connectionRequestId: string }> {
	const session = await createSession();
	const connectionRequest = await session.authorize(toolkit);
	return {
		redirectUrl: connectionRequest.redirectUrl ?? null,
		connectionRequestId: connectionRequest.id,
	};
}

export async function waitForConnection(
	db: PipelineDB,
	requestId: string,
	toolkit: string,
	label?: string,
): Promise<{ id: number; composio_account_id: string }> {
	const composio = await getComposio();
	const account = await composio.connectedAccounts.waitForConnection(
		requestId,
		120_000,
	);
	const composioAccountId = account.id || requestId;

	const row = db
		.insert(schema.connectedAccounts)
		.values({
			toolkit,
			composio_account_id: composioAccountId,
			label: label || toolkit,
			user_id: getUserId(),
			status: "active",
		})
		.returning()
		.get();

	return { id: row.id, composio_account_id: composioAccountId };
}

// ── Account queries ────────────────────────────────────────────

export function listConnectedAccounts(db: PipelineDB) {
	return db.select().from(schema.connectedAccounts).all();
}

export function listAccountsByToolkit(db: PipelineDB, toolkit: string) {
	return db
		.select()
		.from(schema.connectedAccounts)
		.where(eq(schema.connectedAccounts.toolkit, toolkit))
		.all();
}

export async function disconnectAccount(
	db: PipelineDB,
	id: number,
): Promise<void> {
	const account = db
		.select()
		.from(schema.connectedAccounts)
		.where(eq(schema.connectedAccounts.id, id))
		.get();
	if (!account) throw new Error(`Connected account ${id} not found`);

	try {
		const composio = await getComposio();
		await composio.connectedAccounts.delete(account.composio_account_id);
	} catch {
		/* Composio deletion may fail if already removed — proceed with local cleanup */
	}

	db.delete(schema.connectedAccounts)
		.where(eq(schema.connectedAccounts.id, id))
		.run();
}

// ── MCP config for agent runner ────────────────────────────────

export async function getComposioMcpConfig(): Promise<{
	url: string;
	headers: Record<string, string>;
	type: string;
} | null> {
	const config = loadConfig();
	if (!config.integrations?.enabled) return null;
	if (!config.integrations?.composio_api_key && !process.env.COMPOSIO_API_KEY) {
		return null;
	}
	try {
		const session = await createSession();
		const mcp = session.mcp;
		return {
			url: mcp.url,
			headers: mcp.headers || {},
			type: mcp.type || "http",
		};
	} catch {
		return null;
	}
}

// ── Triggers ───────────────────────────────────────────────────

export async function createTrigger(
	db: PipelineDB,
	slug: string,
	triggerConfig?: Record<string, unknown>,
	connectedAccountId?: number,
): Promise<{ id: number; trigger_id: string }> {
	const composio = await getComposio();
	const userId = getUserId();

	const body: Record<string, unknown> = {};
	if (triggerConfig) body.triggerConfig = triggerConfig;

	if (connectedAccountId) {
		const account = db
			.select()
			.from(schema.connectedAccounts)
			.where(eq(schema.connectedAccounts.id, connectedAccountId))
			.get();
		if (account) {
			body.connectedAccountId = account.composio_account_id;
		}
	}

	const result = await composio.triggers.create(userId, slug, body);
	const toolkit = slug.split("_")[0]?.toLowerCase() || "unknown";

	const row = db
		.insert(schema.composioTriggers)
		.values({
			trigger_id: result.triggerId,
			toolkit,
			trigger_slug: slug,
			connected_account_id: connectedAccountId || null,
			config: triggerConfig || {},
			enabled: true,
		})
		.returning()
		.get();

	return { id: row.id, trigger_id: result.triggerId };
}

export function listTriggers(db: PipelineDB) {
	return db.select().from(schema.composioTriggers).all();
}

export async function removeTrigger(db: PipelineDB, id: number): Promise<void> {
	const trigger = db
		.select()
		.from(schema.composioTriggers)
		.where(eq(schema.composioTriggers.id, id))
		.get();
	if (!trigger) throw new Error(`Trigger ${id} not found`);

	try {
		const composio = await getComposio();
		await composio.triggers.delete(trigger.trigger_id);
	} catch {
		/* Composio deletion may fail — proceed with local cleanup */
	}

	db.delete(schema.composioTriggers)
		.where(eq(schema.composioTriggers.id, id))
		.run();
}

// ── Trigger polling ────────────────────────────────────────────

export async function pollTriggerEvents(db: PipelineDB): Promise<number> {
	const config = loadConfig();
	if (!config.integrations?.enabled) return 0;

	const triggers = db
		.select()
		.from(schema.composioTriggers)
		.where(eq(schema.composioTriggers.enabled, true))
		.all();

	if (triggers.length === 0) return 0;

	let count = 0;

	try {
		const composio = await getComposio();
		const activeTriggers = await composio.triggers.listActive({});

		for (const active of activeTriggers.triggers || []) {
			const localTrigger = triggers.find((t) => t.trigger_id === active.id);
			if (!localTrigger) continue;

			const eventType = `composio:${localTrigger.trigger_slug.toLowerCase()}`;
			emitEvent(db, eventType, "trigger", localTrigger.id, {
				trigger_id: localTrigger.trigger_id,
				toolkit: localTrigger.toolkit,
				trigger_slug: localTrigger.trigger_slug,
			});
			count++;

			db.update(schema.composioTriggers)
				.set({ last_polled_at: new Date().toISOString() })
				.where(eq(schema.composioTriggers.id, localTrigger.id))
				.run();
		}
	} catch {
		/* Composio polling failure should not break schedule:run */
	}

	return count;
}

// ── Reset (for testing) ────────────────────────────────────────

export function resetComposio(): void {
	_composio = null;
}
