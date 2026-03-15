import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("project and milestone commands", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`,
		);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("adds a project", () => {
		const output = runPipeline(
			`project:add "Acme Onboarding" --contact jane --value 50000 ${dbFlag}`,
		);
		expect(output).toContain("Added project: Acme Onboarding");
		expect(output).toContain("kickoff");
	});

	it("adds a project with --deal flag", () => {
		runPipeline(
			`deal:add "Acme Contract" --contact jane --org acme --value 30000 ${dbFlag}`,
		);
		const output = runPipeline(
			`project:add "Acme Delivery" --deal acme --value 30000 ${dbFlag}`,
		);
		expect(output).toContain("Added project: Acme Delivery");
	});

	it("deal:close --won --create-project creates a project", () => {
		runPipeline(
			`deal:add "Acme Contract" --contact jane --org acme --value 50000 ${dbFlag}`,
		);
		const output = runPipeline(
			`deal:close acme --won --create-project ${dbFlag}`,
		);
		expect(output).toContain('Closed "Acme Contract" as won');
		expect(output).toContain("Created project: Acme Contract");
	});

	it("lists projects", () => {
		runPipeline(`project:add "Project Alpha" --value 10000 ${dbFlag}`);
		runPipeline(`project:add "Project Beta" --value 20000 ${dbFlag}`);
		const output = runPipeline(`project:list ${dbFlag}`);
		expect(output).toContain("Project Alpha");
		expect(output).toContain("Project Beta");
	});

	it("lists projects with --stage filter", () => {
		runPipeline(`project:add "Alpha" ${dbFlag}`);
		runPipeline(`project:add "Beta" --stage in_progress ${dbFlag}`);
		const output = runPipeline(
			`project:list --stage in_progress --json ${dbFlag}`,
		);
		const projects = JSON.parse(output);
		expect(projects.length).toBe(1);
		expect(projects[0].name).toBe("Beta");
	});

	it("shows project details", () => {
		runPipeline(
			`project:add "Acme Onboarding" --contact jane --value 50000 ${dbFlag}`,
		);
		const output = runPipeline(`project:show acme ${dbFlag}`);
		expect(output).toContain("Acme Onboarding");
		expect(output).toContain("kickoff");
	});

	it("shows project with milestones", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Deliver v1" --project acme --due 2026-04-01 ${dbFlag}`,
		);
		const output = runPipeline(`project:show acme --json ${dbFlag}`);
		const detail = JSON.parse(output);
		expect(detail.milestones.length).toBe(1);
		expect(detail.milestones[0].title).toBe("Deliver v1");
	});

	it("moves a project to a new stage", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(`project:move acme in_progress ${dbFlag}`);
		const output = runPipeline(`project:list --json ${dbFlag}`);
		const projects = JSON.parse(output);
		expect(projects[0].stage).toBe("in_progress");
	});

	it("rejects invalid delivery stage", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		try {
			runPipeline(`project:move acme nonexistent ${dbFlag}`);
			expect.fail("Should have thrown");
		} catch {
			// expected
		}
	});

	it("closes a project", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(`project:close acme ${dbFlag}`);
		// Closed project should not appear in active list
		const output = runPipeline(`project:list ${dbFlag}`);
		expect(output).toContain("No projects found");
		// But should appear with --no-active
		const allOutput = runPipeline(`project:list --no-active --json ${dbFlag}`);
		const projects = JSON.parse(allOutput);
		expect(projects.length).toBe(1);
		expect(projects[0].completed_at).toBeTruthy();
	});

	it("adds a milestone", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		const output = runPipeline(
			`milestone:add "Deliver v1" --project acme --due 2026-04-01 ${dbFlag}`,
		);
		expect(output).toContain("Added milestone: Deliver v1");
		expect(output).toContain("Acme Onboarding");
	});

	it("lists milestones", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Phase 1" --project acme --due 2026-04-01 ${dbFlag}`,
		);
		runPipeline(
			`milestone:add "Phase 2" --project acme --due 2026-04-15 ${dbFlag}`,
		);
		const output = runPipeline(`milestone:list --project acme ${dbFlag}`);
		expect(output).toContain("Phase 1");
		expect(output).toContain("Phase 2");
	});

	it("completes a milestone", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Phase 1" --project acme --due 2026-04-01 ${dbFlag}`,
		);
		runPipeline(`milestone:done "Phase 1" ${dbFlag}`);
		const output = runPipeline(
			`milestone:list --project acme --json ${dbFlag}`,
		);
		const milestones = JSON.parse(output);
		expect(milestones[0].completed).toBe(true);
	});

	it("lists overdue milestones", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Overdue task" --project acme --due 2020-01-01 ${dbFlag}`,
		);
		runPipeline(
			`milestone:add "Future task" --project acme --due 2030-01-01 ${dbFlag}`,
		);
		const output = runPipeline(`milestone:list --overdue --json ${dbFlag}`);
		const milestones = JSON.parse(output);
		expect(milestones.length).toBe(1);
		expect(milestones[0].title).toBe("Overdue task");
	});

	it("shows project and milestone counts in status", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Phase 1" --project acme --due 2026-04-01 ${dbFlag}`,
		);
		const output = runPipeline(`status ${dbFlag}`);
		expect(output).toContain("projects");
		expect(output).toContain("milestones");
	});

	it("includes deliveryHealth in dashboard --json", () => {
		runPipeline(`project:add "Acme Onboarding" ${dbFlag}`);
		runPipeline(
			`milestone:add "Overdue" --project acme --due 2020-01-01 ${dbFlag}`,
		);
		const output = runPipeline(`dashboard --json ${dbFlag}`);
		const data = JSON.parse(output);
		expect(data.deliveryHealth).toBeDefined();
		expect(data.deliveryHealth.activeProjects).toBe(1);
		expect(data.deliveryHealth.overdueMilestones.length).toBe(1);
	});

	it("full project lifecycle: add → milestone → move → done → close", () => {
		runPipeline(`project:add "Lifecycle Project" --value 10000 ${dbFlag}`);
		runPipeline(
			`milestone:add "Setup" --project lifecycle --due 2026-04-01 ${dbFlag}`,
		);
		runPipeline(
			`milestone:add "Launch" --project lifecycle --due 2026-05-01 ${dbFlag}`,
		);
		runPipeline(`project:move lifecycle in_progress ${dbFlag}`);
		runPipeline(`milestone:done setup ${dbFlag}`);
		runPipeline(`project:move lifecycle review ${dbFlag}`);
		runPipeline(`milestone:done launch ${dbFlag}`);
		runPipeline(`project:close lifecycle ${dbFlag}`);

		const output = runPipeline(`project:list --no-active --json ${dbFlag}`);
		const projects = JSON.parse(output);
		const project = projects.find(
			(p: { name: string }) => p.name === "Lifecycle Project",
		);
		expect(project.stage).toBe("complete");
		expect(project.completed_at).toBeTruthy();
	});
});
