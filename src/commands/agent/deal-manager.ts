import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentDealManager extends BaseCommand {
	static override description =
		"Review all active deals for staleness and propose actions";

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(AgentDealManager);
		const agent = getAgent("deal-manager")!;

		await runAgent({
			prompt:
				"Review all active deals. Check for staleness, missing next steps, and priority mismatches. Propose actions as needed.",
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			agentName: "deal-manager",
			onText: (text) => this.log(text),
		});
	}
}
