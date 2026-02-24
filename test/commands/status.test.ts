import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runPipeline } from "../helpers.js";

describe("status", () => {
	it("shows not initialized when no DB exists", () => {
		const dbPath = `/tmp/pipeline-no-exist-${randomUUID()}.db`;
		const output = runPipeline(`status --db ${dbPath}`);
		expect(output).toContain("not initialized");
	});

	it("shows help", () => {
		const output = runPipeline("--help");
		expect(output).toContain("COMMANDS");
	});
});
