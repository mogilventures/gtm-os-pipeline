import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export { schema };
export type PipelineDB = ReturnType<typeof drizzle<typeof schema>>;

const DEFAULT_DB_DIR = join(homedir(), ".pipeline");
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, "pipeline.db");

let _db: PipelineDB | null = null;
let _sqlite: Database.Database | null = null;

export function getDbPath(customPath?: string): string {
	return customPath || DEFAULT_DB_PATH;
}

export function getDb(customPath?: string): PipelineDB {
	if (_db) return _db;
	const dbPath = getDbPath(customPath);

	mkdirSync(dirname(dbPath), { recursive: true });

	_sqlite = new Database(dbPath);
	_sqlite.pragma("journal_mode = WAL");
	_sqlite.pragma("foreign_keys = ON");

	_db = drizzle(_sqlite, { schema });

	runMigrations(_sqlite);

	return _db;
}

export function closeDb(): void {
	if (_sqlite) {
		_sqlite.close();
		_sqlite = null;
		_db = null;
	}
}

export function resetDb(): void {
	_sqlite = null;
	_db = null;
}

function runMigrations(db: Database.Database): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS people (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE,
			phone TEXT,
			linkedin TEXT,
			twitter TEXT,
			location TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS organizations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			domain TEXT,
			industry TEXT,
			size TEXT,
			location TEXT,
			notes TEXT,
			tags TEXT DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS contacts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			person_id INTEGER NOT NULL REFERENCES people(id),
			org_id INTEGER REFERENCES organizations(id),
			role TEXT,
			warmth TEXT DEFAULT 'cold',
			source TEXT,
			tags TEXT DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS deals (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			contact_id INTEGER REFERENCES contacts(id),
			org_id INTEGER REFERENCES organizations(id),
			value INTEGER,
			currency TEXT DEFAULT 'USD',
			stage TEXT NOT NULL DEFAULT 'lead',
			priority TEXT DEFAULT 'medium',
			expected_close TEXT,
			closed_at TEXT,
			won INTEGER,
			close_reason TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS interactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER REFERENCES contacts(id),
			deal_id INTEGER REFERENCES deals(id),
			type TEXT NOT NULL,
			direction TEXT,
			subject TEXT,
			body TEXT,
			occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS tasks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			contact_id INTEGER REFERENCES contacts(id),
			deal_id INTEGER REFERENCES deals(id),
			due TEXT,
			completed INTEGER DEFAULT 0,
			completed_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS pending_actions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			action_type TEXT NOT NULL,
			payload TEXT,
			reasoning TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			resolved_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS edges (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			from_type TEXT NOT NULL,
			from_id INTEGER NOT NULL,
			to_type TEXT NOT NULL,
			to_id INTEGER NOT NULL,
			relation TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_type, from_id);
		CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_type, to_id);
		CREATE INDEX IF NOT EXISTS idx_edges_relation ON edges(relation);

		CREATE TABLE IF NOT EXISTS custom_fields (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			entity_type TEXT NOT NULL,
			entity_id INTEGER NOT NULL,
			field_name TEXT NOT NULL,
			field_value TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(entity_type, entity_id, field_name)
		);

		CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_fields(entity_type, entity_id);
		CREATE INDEX IF NOT EXISTS idx_custom_fields_name ON custom_fields(field_name);

		CREATE TABLE IF NOT EXISTS schedules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			agent_name TEXT NOT NULL UNIQUE,
			interval TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			last_run_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS schedule_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			schedule_id INTEGER NOT NULL REFERENCES schedules(id),
			agent_name TEXT NOT NULL,
			started_at TEXT NOT NULL,
			finished_at TEXT,
			status TEXT NOT NULL DEFAULT 'running',
			output TEXT,
			actions_proposed INTEGER DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);

	// Add email columns to interactions (idempotent migration)
	for (const col of ["message_id TEXT", "from_address TEXT"]) {
		try {
			db.exec(`ALTER TABLE interactions ADD COLUMN ${col}`);
		} catch {
			/* column already exists */
		}
	}
	db.exec(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_message_id ON interactions(message_id) WHERE message_id IS NOT NULL",
	);
}
