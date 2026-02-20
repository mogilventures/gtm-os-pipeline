import { Command, Flags } from "@oclif/core";

export abstract class BaseCommand extends Command {
	static baseFlags = {
		json: Flags.boolean({
			description: "Output as JSON",
			default: false,
		}),
		quiet: Flags.boolean({
			char: "q",
			description: "Minimal output (IDs only)",
			default: false,
		}),
		verbose: Flags.boolean({
			char: "v",
			description: "Verbose output",
			default: false,
		}),
		db: Flags.string({
			description: "Path to database file",
			env: "PIPELINE_DB",
		}),
	};
}
