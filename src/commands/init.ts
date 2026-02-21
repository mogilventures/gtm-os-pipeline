import { existsSync } from "node:fs";
import { BaseCommand } from "../base-command.js";
import {
	getConfigPath,
	getDefaultConfig,
	getPipelineDir,
	saveConfig,
} from "../config.js";
import { getDb, getDbPath } from "../db/index.js";

export default class Init extends BaseCommand {
	static override description =
		"Initialize Pipeline CRM (creates ~/.pipeline/ with DB and config)";

	static override examples = ["<%= config.bin %> init"];

	async run(): Promise<void> {
		const { flags } = await this.parse(Init);

		const dir = getPipelineDir();
		const configPath = getConfigPath();
		const dbPath = getDbPath(flags.db);

		// Create config if it doesn't exist
		if (!existsSync(configPath)) {
			const config = getDefaultConfig();
			saveConfig(config);
			this.log(`Created config: ${configPath}`);
		} else {
			this.log(`Config already exists: ${configPath}`);
		}

		// Initialize database
		if (!existsSync(dbPath)) {
			getDb(flags.db);
			this.log(`Created database: ${dbPath}`);
		} else {
			getDb(flags.db);
			this.log(`Database already exists: ${dbPath}`);
		}

		this.log(`\nPipeline initialized at ${dir}`);
		this.log("Run `pipeline status` to see your CRM.");
	}
}
