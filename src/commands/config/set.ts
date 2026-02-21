import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { loadConfig, saveConfig, setConfigValue } from "../../config.js";

export default class ConfigSet extends BaseCommand {
	static override description = "Set a config value (dot-notation keys)";

	static override examples = [
		"<%= config.bin %> config:set pipeline.currency EUR",
		"<%= config.bin %> config:set agent.model claude-opus-4-6",
	];

	static override args = {
		key: Args.string({
			description: "Config key (dot-notation)",
			required: true,
		}),
		value: Args.string({ description: "Value to set", required: true }),
	};

	async run(): Promise<void> {
		const { args } = await this.parse(ConfigSet);
		const config = loadConfig();
		setConfigValue(config, args.key, args.value);
		saveConfig(config);
		this.log(`Set ${args.key} = ${args.value}`);
	}
}
