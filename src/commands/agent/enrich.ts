import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import { runAgent } from "../../services/agent-runner.js";
import { getAgent } from "../../services/subagents.js";

export default class AgentEnrich extends BaseCommand {
	static override description = "Research a contact and update their records";

	static override args = {
		contact: Args.string({
			description: "Contact name to enrich",
			required: true,
		}),
	};

	static override flags = {
		...BaseCommand.baseFlags,
		model: Flags.string({ description: "Model to use" }),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(AgentEnrich);
		const agent = getAgent("enrich")!;

		await runAgent({
			prompt: `Enrich the contact "${args.contact}" — look up their information and update records.`,
			systemPrompt: agent.prompt,
			dbPath: flags.db,
			model: flags.model,
			verbose: flags.verbose,
			onText: (text) => this.log(text),
		});
	}
}
