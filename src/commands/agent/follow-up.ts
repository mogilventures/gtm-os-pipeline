import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentFollowUp extends BaseCommand {
	static override description =
		"Check stale contacts and propose follow-up emails";

	static override flags = {
		...BaseCommand.baseFlags,
		days: Flags.integer({
			description: "Days since last contact",
			default: 14,
		}),
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(AgentFollowUp);
		const agent = getAgent("follow-up")!;

		await runAgent({
			prompt: `Check contacts stale for ${flags.days} days and propose follow-ups.`,
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			onText: (text) => this.log(text),
		});
	}
}
