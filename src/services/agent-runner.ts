import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "../config.js";
import { getDb, getDbPath } from "../db/index.js";
import { writeAuditLog } from "./audit.js";

interface AgentRunOptions {
	prompt: string;
	systemPrompt: string;
	dbPath?: string;
	model?: string;
	verbose?: boolean;
	agentName?: string;
	runId?: string;
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
	const runId = opts.runId || randomUUID();

	const mcpArgs = [
		new URL("../../bin/mcp.js", import.meta.url).pathname,
		"--db",
		dbPath,
	];

	if (opts.agentName) {
		mcpArgs.push("--agent-name", opts.agentName);
	}
	mcpArgs.push("--run-id", runId);

	const transport = new StdioClientTransport({
		command: "node",
		args: mcpArgs,
	});
	const mcpClient = new Client({ name: "pipeline-agent", version: "0.1.0" });
	await mcpClient.connect(transport);

	// Optionally connect to Composio MCP as second server
	let composioClient: Client | null = null;
	const localToolNames = new Set<string>();

	try {
		const { tools: mcpTools } = await mcpClient.listTools();
		const tools: any[] = mcpTools.map((t: any) => ({
			name: t.name,
			description: t.description || "",
			input_schema: t.inputSchema,
		}));

		// Track local tool names for routing
		for (const t of tools) {
			localToolNames.add(t.name);
		}

		// Connect to Composio MCP if configured
		try {
			const { getComposioMcpConfig } = await import("./composio.js");
			const composioMcp = await getComposioMcpConfig();
			if (composioMcp) {
				const { StreamableHTTPClientTransport } = await import(
					"@modelcontextprotocol/sdk/client/streamableHttp.js"
				);
				const composioTransport = new StreamableHTTPClientTransport(
					new URL(composioMcp.url),
					{ requestInit: { headers: composioMcp.headers } },
				);
				composioClient = new Client({
					name: "pipeline-composio",
					version: "0.1.0",
				});
				await composioClient.connect(composioTransport);

				const { tools: composioTools } = await composioClient.listTools();
				for (const t of composioTools) {
					// Avoid name collisions — Composio tools win for external services
					if (!localToolNames.has(t.name)) {
						tools.push({
							name: t.name,
							description: t.description || "",
							input_schema: t.inputSchema,
						});
					}
				}

				if (opts.verbose) {
					opts.onText(
						`\n[Composio] ${composioTools.length} external tool(s) available`,
					);
				}
			}
		} catch {
			/* Composio not configured or unavailable — continue with local tools only */
		}

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
					const toolStart = Date.now();

					// Route to the correct MCP client
					const targetClient = localToolNames.has(block.name)
						? mcpClient
						: composioClient || mcpClient;

					try {
						const result = await targetClient.callTool({
							name: block.name,
							arguments: block.input as Record<string, unknown>,
						});
						const toolDuration = Date.now() - toolStart;
						try {
							const db = getDb(opts.dbPath);
							writeAuditLog(db, {
								actor: opts.agentName || "agent",
								command: block.name,
								args: JSON.stringify(block.input),
								result: "success",
								duration_ms: toolDuration,
							});
						} catch {
							/* audit failure must not break agent */
						}
						toolResults.push({
							type: "tool_result",
							tool_use_id: block.id,
							content: (result.content as Array<{ text: string }>)
								.map((c) => c.text)
								.join("\n"),
						});
					} catch (error) {
						const toolDuration = Date.now() - toolStart;
						try {
							const db = getDb(opts.dbPath);
							writeAuditLog(db, {
								actor: opts.agentName || "agent",
								command: block.name,
								args: JSON.stringify(block.input),
								result: "error",
								error: error instanceof Error ? error.message : String(error),
								duration_ms: toolDuration,
							});
						} catch {
							/* audit failure must not break agent */
						}
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
		if (composioClient) {
			await composioClient.close().catch(() => {});
		}
	}
}
