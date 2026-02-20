import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentQualify extends BaseCommand {
	static override description = "Assess deal health and qualification";

	static override args = {
		deal: Args.string({ description: "Deal name to qualify", required: true }),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(AgentQualify);
		const agent = getAgent("qualify")!;

		await runAgent({
			prompt: `Qualify the deal "${args.deal}" — assess its health and suggest next actions.`,
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			onText: (text) => this.log(text),
		});
	}
}
