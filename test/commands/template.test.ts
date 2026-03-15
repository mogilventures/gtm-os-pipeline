import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("template commands", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("adds a template and auto-extracts variables", () => {
		const output = runPipeline(
			`template:add "follow-up" --subject "Following up, {{first_name}}" --body "Hi {{first_name}}, checking in about {{company}}." ${dbFlag}`,
		);
		expect(output).toContain("Added template: follow-up");
		expect(output).toContain("Variables: company, first_name");
	});

	it("adds a template with category", () => {
		const output = runPipeline(
			`template:add "intro" --subject "Hello" --body "Hi there" --category outreach ${dbFlag}`,
		);
		expect(output).toContain("Added template: intro");
	});

	it("lists templates", () => {
		runPipeline(
			`template:add "tmpl1" --subject "Sub1" --body "Body1" ${dbFlag}`,
		);
		runPipeline(
			`template:add "tmpl2" --subject "Sub2" --body "Body2" --category sales ${dbFlag}`,
		);
		const output = runPipeline(`template:list ${dbFlag}`);
		expect(output).toContain("tmpl1");
		expect(output).toContain("tmpl2");
	});

	it("lists templates filtered by category", () => {
		runPipeline(
			`template:add "tmpl1" --subject "Sub1" --body "Body1" --category sales ${dbFlag}`,
		);
		runPipeline(
			`template:add "tmpl2" --subject "Sub2" --body "Body2" --category support ${dbFlag}`,
		);
		const output = runPipeline(
			`template:list --category sales --json ${dbFlag}`,
		);
		const templates = JSON.parse(output);
		expect(templates).toHaveLength(1);
		expect(templates[0].name).toBe("tmpl1");
	});

	it("shows a template", () => {
		runPipeline(
			`template:add "follow-up" --subject "Following up, {{first_name}}" --body "Hi {{first_name}}" ${dbFlag}`,
		);
		const output = runPipeline(`template:show follow-up ${dbFlag}`);
		expect(output).toContain("Name:      follow-up");
		expect(output).toContain("Subject:   Following up, {{first_name}}");
		expect(output).toContain("Variables: first_name");
	});

	it("edits a template", () => {
		runPipeline(
			`template:add "follow-up" --subject "Old subject" --body "Old body" ${dbFlag}`,
		);
		const output = runPipeline(
			`template:edit follow-up --subject "New subject {{name}}" ${dbFlag}`,
		);
		expect(output).toContain("Updated template: follow-up");
		expect(output).toContain("Variables: name");
	});

	it("edits template and re-extracts variables", () => {
		runPipeline(
			`template:add "tmpl" --subject "Hi {{first_name}}" --body "Body" ${dbFlag}`,
		);
		runPipeline(
			`template:edit tmpl --body "New body with {{company}} and {{email}}" ${dbFlag}`,
		);
		const output = runPipeline(`template:show tmpl --json ${dbFlag}`);
		const tmpl = JSON.parse(output);
		expect(tmpl.variables).toContain("first_name");
		expect(tmpl.variables).toContain("company");
		expect(tmpl.variables).toContain("email");
	});

	it("removes a template", () => {
		runPipeline(`template:add "to-delete" --subject "S" --body "B" ${dbFlag}`);
		const output = runPipeline(`template:rm to-delete ${dbFlag}`);
		expect(output).toContain("Removed template: to-delete");

		const list = runPipeline(`template:list ${dbFlag}`);
		expect(list).not.toContain("to-delete");
	});

	it("returns JSON output for add", () => {
		const output = runPipeline(
			`template:add "json-test" --subject "Hi {{name}}" --body "Hello" --json ${dbFlag}`,
		);
		const tmpl = JSON.parse(output);
		expect(tmpl.name).toBe("json-test");
		expect(tmpl.variables).toContain("name");
	});

	it("returns JSON output for list", () => {
		runPipeline(`template:add "t1" --subject "S" --body "B" ${dbFlag}`);
		const output = runPipeline(`template:list --json ${dbFlag}`);
		const templates = JSON.parse(output);
		expect(templates).toHaveLength(1);
		expect(templates[0].name).toBe("t1");
	});

	it("rejects duplicate template names", () => {
		runPipeline(`template:add "dup" --subject "S" --body "B" ${dbFlag}`);
		expect(() =>
			runPipeline(`template:add "dup" --subject "S2" --body "B2" ${dbFlag}`),
		).toThrow();
	});
});
