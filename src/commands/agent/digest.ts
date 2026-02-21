import { Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentDigest extends BaseCommand {
	static override description = "Morning pipeline briefing and daily digest";

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(AgentDigest);
		const agent = getAgent("digest")!;

		await runAgent({
			prompt: "Create my morning pipeline briefing.",
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			agentName: "digest",
			onText: (text) => this.log(text),
		});
	}
}
