// @ts-nocheck — MCP SDK types don't resolve via Node16 moduleResolution
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("MCP server", () => {
	let tmpDir: string;
	let dbPath: string;
	let client: InstanceType<typeof Client>;

	beforeEach(async () => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
		runPipeline(`init --db ${dbPath}`);
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --db ${dbPath}`);
		runPipeline(`deal:add "Acme Deal" --value 10000 --stage proposal --db ${dbPath}`);

		const transport = new StdioClientTransport({
			command: "node",
			args: [join(import.meta.dirname, "..", "..", "bin", "mcp.js"), "--db", dbPath],
		});
		client = new Client({ name: "test-client", version: "0.1.0" });
		await client.connect(transport);
	});

	afterEach(async () => {
		await client.close().catch(() => {});
		cleanupTmpDir(tmpDir);
	});

	it("searches contacts via MCP tool", async () => {
		const result = await client.callTool({
			name: "search_contacts",
			arguments: { query: "jane" },
		});
		const text = (result.content as Array<{ text: string }>)[0].text;
		const data = JSON.parse(text);
		expect(data.length).toBeGreaterThan(0);
		expect(data[0].name).toBe("Jane Smith");
	});

	it("lists deals via MCP tool", async () => {
		const result = await client.callTool({
			name: "list_deals",
			arguments: {},
		});
		const text = (result.content as Array<{ text: string }>)[0].text;
		const data = JSON.parse(text);
		expect(data.length).toBeGreaterThan(0);
		expect(data[0].title).toBe("Acme Deal");
	});

	it("proposes an action via MCP tool", async () => {
		const result = await client.callTool({
			name: "propose_action",
			arguments: {
				action_type: "send_email",
				payload: JSON.stringify({ to: "jane@acme.co", body: "Follow up" }),
				reasoning: "No recent contact",
			},
		});
		const text = (result.content as Array<{ text: string }>)[0].text;
		expect(text).toContain("Action proposed");
	});

	it("gets related entities via MCP tool", async () => {
		const result = await client.callTool({
			name: "get_related",
			arguments: { name: "Jane Smith" },
		});
		const text = (result.content as Array<{ text: string }>)[0].text;
		const data = JSON.parse(text);
		expect(data.entity.type).toBe("person");
		expect(data.entity.name).toBe("Jane Smith");
	});
});
