import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "../config.js";
import { getDbPath } from "../db/index.js";

interface AgentRunOptions {
	prompt: string;
	systemPrompt: string;
	dbPath?: string;
	model?: string;
	verbose?: boolean;
	onText: (text: string) => void;
}

export async function runAgent(opts: AgentRunOptions): Promise<void> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY environment variable is required.\nSet it with: export ANTHROPIC_API_KEY=sk-ant-...",
		);
	}

	const config = loadConfig();
	const model =
		opts.model || (config.agent.model as string) || "claude-sonnet-4-6";
	const dbPath = getDbPath(opts.dbPath);

	const transport = new StdioClientTransport({
		command: "node",
		args: [
			new URL("../../bin/mcp.js", import.meta.url).pathname,
			"--db",
			dbPath,
		],
	});
	const mcpClient = new Client({ name: "pipeline-agent", version: "0.1.0" });
	await mcpClient.connect(transport);

	try {
		const { tools: mcpTools } = await mcpClient.listTools();
		const tools = mcpTools.map((t: any) => ({
			name: t.name,
			description: t.description || "",
			input_schema: t.inputSchema,
		}));

		const { default: Anthropic } = await import("@anthropic-ai/sdk");
		const client = new Anthropic({ apiKey });

		const messages: any[] = [{ role: "user", content: opts.prompt }];

		let continueLoop = true;
		while (continueLoop) {
			const response = await client.messages.create({
				model,
				max_tokens: 4096,
				system: opts.systemPrompt,
				tools,
				messages,
			} as any);

			let hasToolUse = false;
			const toolResults: any[] = [];

			for (const block of response.content) {
				if (block.type === "text") {
					opts.onText(block.text);
				} else if (block.type === "tool_use") {
					hasToolUse = true;
					if (opts.verbose) {
						opts.onText(`\n[Tool: ${block.name}]`);
					}
					try {
						const result = await mcpClient.callTool({
							name: block.name,
							arguments: block.input as Record<string, unknown>,
						});
						toolResults.push({
							type: "tool_result",
							tool_use_id: block.id,
							content: (result.content as Array<{ text: string }>)
								.map((c) => c.text)
								.join("\n"),
						});
					} catch (error) {
						toolResults.push({
							type: "tool_result",
							tool_use_id: block.id,
							content: `Error: ${error instanceof Error ? error.message : String(error)}`,
						});
					}
				}
			}

			if (hasToolUse) {
				messages.push({ role: "assistant", content: response.content });
				messages.push({ role: "user", content: toolResults });
			} else {
				continueLoop = false;
			}

			if (response.stop_reason === "end_turn" && !hasToolUse) {
				continueLoop = false;
			}
		}
	} finally {
		await mcpClient.close().catch(() => {});
	}
}
