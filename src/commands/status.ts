import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { BaseCommand } from "../base-command.js";
import { getConfigPath, loadConfig } from "../config.js";
import { getDb, getDbPath, schema } from "../db/index.js";

export default class Status extends BaseCommand {
	static override description = "Show pipeline status and database stats";

	static override examples = ["<%= config.bin %> status"];

	async run(): Promise<void> {
		const { flags } = await this.parse(Status);
		const dbPath = getDbPath(flags.db);
		const configPath = getConfigPath();

		if (!existsSync(dbPath)) {
			this.log("Pipeline not initialized. Run `pipeline init` first.");
			return;
		}

		const db = getDb(flags.db);

		const counts = {
			contacts: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.contacts)
				.get()!.count,
			organizations: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.organizations)
				.get()!.count,
			deals: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.deals)
				.get()!.count,
			interactions: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.interactions)
				.get()!.count,
			tasks: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.tasks)
				.get()!.count,
			pending_actions: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.pendingActions)
				.get()!.count,
			edges: db
				.select({ count: sql<number>`count(*)` })
				.from(schema.edges)
				.get()!.count,
		};

		this.log("Pipeline CRM Status");
		this.log("═".repeat(30));
		this.log(`Database: ${dbPath}`);
		this.log(`Config:   ${configPath}`);
		this.log("");
		this.log("Records:");
		for (const [table, count] of Object.entries(counts)) {
			this.log(`  ${table.padEnd(18)} ${count}`);
		}
	}
}
