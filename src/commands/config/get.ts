import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { getConfigValue, loadConfig } from "../../config.js";

export default class ConfigGet extends BaseCommand {
	static override description = "Get a config value";

	static override examples = [
		"<%= config.bin %> config:get pipeline.currency",
		"<%= config.bin %> config:get agent.model",
	];

	static override args = {
		key: Args.string({ description: "Config key (dot-notation)", required: true }),
	};

	async run(): Promise<void> {
		const { args } = await this.parse(ConfigGet);
		const config = loadConfig();
		const value = getConfigValue(config, args.key);
		if (value === undefined) {
			this.log(`Key "${args.key}" not found`);
		} else {
			this.log(typeof value === "object" ? JSON.stringify(value) : String(value));
		}
	}
}
