import { describe, expect, it } from "vitest";
import { runPipeline } from "../helpers.js";

describe("status", () => {
	it("shows not initialized when no DB exists", () => {
		const output = runPipeline("status --db /tmp/nonexistent-pipeline-test.db");
		expect(output).toContain("not initialized");
	});

	it("shows help", () => {
		const output = runPipeline("--help");
		expect(output).toContain("COMMANDS");
	});
});
