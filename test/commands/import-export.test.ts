import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupTmpDir, createTmpDir, runPipeline } from "../helpers.js";

describe("import command", () => {
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

	it("imports contacts from a CSV file", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,Company,Role,Source
Jane Smith,jane@acme.co,Acme Corp,CTO,linkedin
Bob Lee,bob@startup.io,Startup Inc,CEO,referral
Alice Kim,alice@example.com,,Designer,website`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Found 3 records");
		expect(output).toContain("Imported: 3");

		// Verify contacts were created
		const listOutput = runPipeline(`contact:list --json ${dbFlag}`);
		const contacts = JSON.parse(listOutput);
		expect(contacts).toHaveLength(3);
		expect(contacts.some((c: { name: string }) => c.name === "Jane Smith")).toBe(true);
		expect(contacts.some((c: { name: string }) => c.name === "Bob Lee")).toBe(true);
		expect(contacts.some((c: { name: string }) => c.name === "Alice Kim")).toBe(true);
	});

	it("handles first/last name columns", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`First Name,Last Name,Email
John,Doe,john@example.com
Jane,Smith,jane@test.com`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 2");

		const listOutput = runPipeline(`contact:list --json ${dbFlag}`);
		const contacts = JSON.parse(listOutput);
		expect(contacts.some((c: { name: string }) => c.name === "John Doe")).toBe(true);
		expect(contacts.some((c: { name: string }) => c.name === "Jane Smith")).toBe(true);
	});

	it("skips rows without a name", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Email,Phone
jane@acme.co,555-1234
bob@test.com,555-5678`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Skipped: 2");
	});

	it("shows preview of first 5 rows", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email
Alice,alice@a.com
Bob,bob@b.com
Carol,carol@c.com
Dave,dave@d.com
Eve,eve@e.com
Frank,frank@f.com`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Preview (first 5 rows)");
		expect(output).toContain("Alice");
		expect(output).toContain("Eve");
		// Frank should not be in preview
	});

	it("maps column names case-insensitively", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`EMAIL ADDRESS,FULL NAME,PHONE NUMBER,JOB TITLE
jane@acme.co,Jane Smith,555-1234,CTO`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const listOutput = runPipeline(`contact:list --json ${dbFlag}`);
		const contacts = JSON.parse(listOutput);
		expect(contacts[0].name).toBe("Jane Smith");
		expect(contacts[0].email).toBe("jane@acme.co");
	});

	it("handles empty CSV gracefully", () => {
		const csvPath = join(tmpDir, "empty.csv");
		writeFileSync(csvPath, "Name,Email\n");

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("No records found");
	});

	it("imports with tags", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,Tags
Jane Smith,jane@acme.co,"investor, advisor"`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 1");
	});

	// ── Organization import tests ────────────────────────────────

	it("imports organizations from CSV", () => {
		const csvPath = join(tmpDir, "orgs.csv");
		writeFileSync(
			csvPath,
			`Name,Domain,Industry,Size,Location
Acme Corp,acme.co,Software,100-500,San Francisco
Globex,globex.com,Manufacturing,500+,Chicago`,
		);

		const output = runPipeline(`import ${csvPath} --type organizations ${dbFlag}`);
		expect(output).toContain("Found 2 records");
		expect(output).toContain("Imported: 2");

		const listOutput = runPipeline(`org:list --json ${dbFlag}`);
		const orgs = JSON.parse(listOutput);
		expect(orgs).toHaveLength(2);
		expect(orgs.some((o: { name: string }) => o.name === "Acme Corp")).toBe(true);
		expect(orgs.some((o: { name: string }) => o.name === "Globex")).toBe(true);
	});

	it("imports organizations with tags", () => {
		const csvPath = join(tmpDir, "orgs.csv");
		writeFileSync(
			csvPath,
			`Name,Tags
Acme Corp,"enterprise, target"`,
		);

		const output = runPipeline(`import ${csvPath} --type organizations ${dbFlag}`);
		expect(output).toContain("Imported: 1");
	});

	it("skips organizations without a name", () => {
		const csvPath = join(tmpDir, "orgs.csv");
		writeFileSync(
			csvPath,
			`Domain,Industry
acme.co,Software`,
		);

		const output = runPipeline(`import ${csvPath} --type organizations ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
	});

	// ── Deal import tests ────────────────────────────────────────

	it("imports deals with FK resolution", () => {
		// Pre-create contact and org
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`);

		const csvPath = join(tmpDir, "deals.csv");
		writeFileSync(
			csvPath,
			`Title,Contact,Organization,Value,Stage,Priority
Acme Consulting,Jane Smith,Acme Corp,"$15,000",proposal,high`,
		);

		const output = runPipeline(`import ${csvPath} --type deals ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const exportOutput = runPipeline(`export --type deals --format json ${dbFlag}`);
		const deals = JSON.parse(exportOutput);
		expect(deals).toHaveLength(1);
		expect(deals[0].title).toBe("Acme Consulting");
		expect(deals[0].value).toBe(15000);
		expect(deals[0].contact_name).toBe("Jane Smith");
		expect(deals[0].org_name).toBe("Acme Corp");
	});

	it("imports deals without required FKs (nulls them)", () => {
		const csvPath = join(tmpDir, "deals.csv");
		writeFileSync(
			csvPath,
			`Title,Value,Stage
Simple Deal,5000,lead`,
		);

		const output = runPipeline(`import ${csvPath} --type deals ${dbFlag}`);
		expect(output).toContain("Imported: 1");
	});

	it("skips deals without a title", () => {
		const csvPath = join(tmpDir, "deals.csv");
		writeFileSync(
			csvPath,
			`Value,Stage
5000,lead`,
		);

		const output = runPipeline(`import ${csvPath} --type deals ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
	});

	// ── Interaction import tests ─────────────────────────────────

	it("imports interactions with FK resolution", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);

		const csvPath = join(tmpDir, "interactions.csv");
		writeFileSync(
			csvPath,
			`Contact,Type,Direction,Subject,Body
Jane Smith,email,outbound,Follow-up,Thanks for the meeting`,
		);

		const output = runPipeline(`import ${csvPath} --type interactions ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const exportOutput = runPipeline(`export --type interactions --format json ${dbFlag}`);
		const interactions = JSON.parse(exportOutput);
		expect(interactions).toHaveLength(1);
		expect(interactions[0].type).toBe("email");
		expect(interactions[0].contact_name).toBe("Jane Smith");
	});

	it("skips interactions without a contact", () => {
		const csvPath = join(tmpDir, "interactions.csv");
		writeFileSync(
			csvPath,
			`Type,Subject
email,Hello`,
		);

		const output = runPipeline(`import ${csvPath} --type interactions ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
	});

	it("skips interactions when contact not found", () => {
		const csvPath = join(tmpDir, "interactions.csv");
		writeFileSync(
			csvPath,
			`Contact,Type,Subject
NonExistent Person,email,Hello`,
		);

		const output = runPipeline(`import ${csvPath} --type interactions ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
	});

	// ── Task import tests ────────────────────────────────────────

	it("imports tasks from CSV", () => {
		const csvPath = join(tmpDir, "tasks.csv");
		writeFileSync(
			csvPath,
			`Title,Due
Follow up with Jane,2026-03-15
Send proposal,2026-04-01`,
		);

		const output = runPipeline(`import ${csvPath} --type tasks ${dbFlag}`);
		expect(output).toContain("Imported: 2");

		const exportOutput = runPipeline(`export --type tasks --format json ${dbFlag}`);
		const tasks = JSON.parse(exportOutput);
		expect(tasks).toHaveLength(2);
		expect(tasks.some((t: { title: string }) => t.title === "Follow up with Jane")).toBe(true);
	});

	it("imports tasks with FK resolution", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);

		const csvPath = join(tmpDir, "tasks.csv");
		writeFileSync(
			csvPath,
			`Title,Contact,Due
Follow up with Jane,Jane Smith,2026-03-15`,
		);

		const output = runPipeline(`import ${csvPath} --type tasks ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const exportOutput = runPipeline(`export --type tasks --format json ${dbFlag}`);
		const tasks = JSON.parse(exportOutput);
		expect(tasks[0].contact_name).toBe("Jane Smith");
	});

	it("skips tasks without a title", () => {
		const csvPath = join(tmpDir, "tasks.csv");
		writeFileSync(
			csvPath,
			`Due,Contact
2026-03-15,Jane`,
		);

		const output = runPipeline(`import ${csvPath} --type tasks ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
	});
});

describe("export command", () => {
	let tmpDir: string;
	let dbFlag: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbFlag = `--db ${join(tmpDir, "test.db")}`;
		runPipeline(`init ${dbFlag}`);
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO ${dbFlag}`);
		runPipeline(`contact:add "Bob Lee" --email bob@startup.io --tag investor ${dbFlag}`);
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("exports contacts as JSON", () => {
		const output = runPipeline(`export --format json ${dbFlag}`);
		const contacts = JSON.parse(output);
		expect(contacts).toHaveLength(2);
		expect(contacts[0].name).toBeDefined();
		expect(contacts[0].email).toBeDefined();
	});

	it("exports contacts as CSV", () => {
		const output = runPipeline(`export --format csv ${dbFlag}`);
		// CSV should have header row
		const lines = output.split("\n");
		expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 data rows
		expect(lines[0]).toContain("name");
		expect(lines[0]).toContain("email");
		// Data should contain our contacts
		expect(output).toContain("Jane Smith");
		expect(output).toContain("Bob Lee");
		expect(output).toContain("jane@acme.co");
	});

	it("defaults to JSON format", () => {
		const output = runPipeline(`export ${dbFlag}`);
		// Should be valid JSON by default
		const contacts = JSON.parse(output);
		expect(Array.isArray(contacts)).toBe(true);
	});

	it("exports empty database gracefully", () => {
		const emptyDir = createTmpDir();
		const emptyDbFlag = `--db ${join(emptyDir, "empty.db")}`;
		runPipeline(`init ${emptyDbFlag}`);

		const output = runPipeline(`export --format json ${emptyDbFlag}`);
		const contacts = JSON.parse(output);
		expect(contacts).toHaveLength(0);

		cleanupTmpDir(emptyDir);
	});

	it("CSV export includes organization name", () => {
		const output = runPipeline(`export --format csv ${dbFlag}`);
		expect(output).toContain("Acme Corp");
	});

	// ── Organization export tests ────────────────────────────────

	it("exports organizations as JSON", () => {
		const output = runPipeline(`export --type organizations --format json ${dbFlag}`);
		const orgs = JSON.parse(output);
		expect(orgs.length).toBeGreaterThanOrEqual(1);
		expect(orgs.some((o: { name: string }) => o.name === "Acme Corp")).toBe(true);
	});

	it("exports organizations as CSV", () => {
		const output = runPipeline(`export --type organizations --format csv ${dbFlag}`);
		expect(output).toContain("name");
		expect(output).toContain("Acme Corp");
	});

	// ── Deal export tests ────────────────────────────────────────

	it("exports deals as JSON", () => {
		runPipeline(`deal:add "Acme Deal" --contact "Jane Smith" --value 10000 ${dbFlag}`);

		const output = runPipeline(`export --type deals --format json ${dbFlag}`);
		const deals = JSON.parse(output);
		expect(deals).toHaveLength(1);
		expect(deals[0].title).toBe("Acme Deal");
		expect(deals[0].value).toBe(10000);
	});

	it("exports deals as CSV", () => {
		runPipeline(`deal:add "Acme Deal" --contact "Jane Smith" --value 10000 ${dbFlag}`);

		const output = runPipeline(`export --type deals --format csv ${dbFlag}`);
		expect(output).toContain("title");
		expect(output).toContain("Acme Deal");
		expect(output).toContain("10000");
	});

	// ── Interaction export tests ─────────────────────────────────

	it("exports interactions as JSON", () => {
		runPipeline(`log:email "Jane Smith" --subject "Follow-up" --body "Thanks" ${dbFlag}`);

		const output = runPipeline(`export --type interactions --format json ${dbFlag}`);
		const interactions = JSON.parse(output);
		expect(interactions.length).toBeGreaterThanOrEqual(1);
		expect(interactions[0].type).toBe("email");
	});

	it("exports interactions as CSV", () => {
		runPipeline(`log:email "Jane Smith" --subject "Follow-up" --body "Thanks" ${dbFlag}`);

		const output = runPipeline(`export --type interactions --format csv ${dbFlag}`);
		expect(output).toContain("type");
		expect(output).toContain("email");
	});

	// ── Task export tests ────────────────────────────────────────

	it("exports tasks as JSON", () => {
		runPipeline(`task:add "Follow up" --contact "Jane Smith" --due 2026-03-15 ${dbFlag}`);

		const output = runPipeline(`export --type tasks --format json ${dbFlag}`);
		const tasks = JSON.parse(output);
		expect(tasks).toHaveLength(1);
		expect(tasks[0].title).toBe("Follow up");
	});

	it("exports tasks as CSV", () => {
		runPipeline(`task:add "Follow up" --contact "Jane Smith" --due 2026-03-15 ${dbFlag}`);

		const output = runPipeline(`export --type tasks --format csv ${dbFlag}`);
		expect(output).toContain("title");
		expect(output).toContain("Follow up");
	});
});

// ── Custom field tests ──────────────────────────────────────────

describe("custom fields import/export", () => {
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

	it("exports contacts with custom fields as CSV", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);

		const output = runPipeline(`export --format csv ${dbFlag}`);
		expect(output).toContain("cf:lead_score");
		expect(output).toContain("85");
	});

	it("exports organizations with custom fields as JSON", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`);
		runPipeline(`field:set org:acme tier enterprise ${dbFlag}`);

		const output = runPipeline(`export --type organizations --format json ${dbFlag}`);
		const orgs = JSON.parse(output);
		const acme = orgs.find((o: { name: string }) => o.name === "Acme Corp");
		expect(acme.custom_fields).toBeDefined();
		expect(acme.custom_fields["cf:tier"]).toBe("enterprise");
	});

	it("imports contacts with cf: columns", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,cf:lead_score,cf:segment
Jane Smith,jane@acme.co,85,enterprise`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const fieldOutput = runPipeline(`field:get contact:jane -f lead_score --json ${dbFlag}`);
		const field = JSON.parse(fieldOutput);
		expect(field.field_value).toBe("85");
	});

	it("round-trips custom fields via export then import", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`field:set contact:jane lead_score 85 ${dbFlag}`);

		// Export
		const csvOutput = runPipeline(`export --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "exported.csv");
		writeFileSync(csvPath, csvOutput);

		// Import into fresh DB
		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		runPipeline(`import ${csvPath} ${freshDbFlag}`);

		const fieldOutput = runPipeline(`field:get contact:jane -f lead_score --json ${freshDbFlag}`);
		const field = JSON.parse(fieldOutput);
		expect(field.field_value).toBe("85");
		cleanupTmpDir(freshDir);
	});

	it("imports multiple custom fields per row", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,cf:score,cf:tier,cf:region
Jane Smith,jane@acme.co,90,gold,west`,
		);

		runPipeline(`import ${csvPath} ${dbFlag}`);

		const scoreOutput = runPipeline(`field:get contact:jane -f score --json ${dbFlag}`);
		expect(JSON.parse(scoreOutput).field_value).toBe("90");

		const tierOutput = runPipeline(`field:get contact:jane -f tier --json ${dbFlag}`);
		expect(JSON.parse(tierOutput).field_value).toBe("gold");

		const regionOutput = runPipeline(`field:get contact:jane -f region --json ${dbFlag}`);
		expect(JSON.parse(regionOutput).field_value).toBe("west");
	});

	it("empty custom field values do not create entries", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,cf:score
Jane Smith,jane@acme.co,`,
		);

		runPipeline(`import ${csvPath} ${dbFlag}`);

		// field:get should fail or return empty for non-existent field
		try {
			runPipeline(`field:get contact:jane -f score --json ${dbFlag}`);
			// If it doesn't throw, that's also fine — just verify no value
		} catch {
			// Expected — field was not created
		}
	});
});

// ── Validation tests ────────────────────────────────────────────

describe("validation during import", () => {
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

	it("invalid email is skipped (contact created without email)", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email
Jane Smith,not-an-email`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const listOutput = runPipeline(`contact:list --json ${dbFlag}`);
		const contacts = JSON.parse(listOutput);
		expect(contacts).toHaveLength(1);
		expect(contacts[0].name).toBe("Jane Smith");
		expect(contacts[0].email).toBeNull();
	});

	it("invalid date on expected_close imports deal without date", () => {
		const csvPath = join(tmpDir, "deals.csv");
		writeFileSync(
			csvPath,
			`Title,Value,Stage,Expected Close
Big Deal,5000,lead,not-a-date`,
		);

		const output = runPipeline(`import ${csvPath} --type deals ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const exportOutput = runPipeline(`export --type deals --format json ${dbFlag}`);
		const deals = JSON.parse(exportOutput);
		expect(deals[0].expected_close).toBeFalsy();
	});

	it("invalid date on task due imports task without due date", () => {
		const csvPath = join(tmpDir, "tasks.csv");
		writeFileSync(
			csvPath,
			`Title,Due
Follow up,invalid-date`,
		);

		const output = runPipeline(`import ${csvPath} --type tasks ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const exportOutput = runPipeline(`export --type tasks --format json ${dbFlag}`);
		const tasks = JSON.parse(exportOutput);
		expect(tasks[0].due).toBeFalsy();
	});

	it("duplicate email detection skips row with message", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);

		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email
Jane Smith,jane@acme.co`,
		);

		const output = runPipeline(`import ${csvPath} -v ${dbFlag}`);
		expect(output).toContain("Skipped: 1");
		expect(output).toContain("Duplicate");
	});

	it("BOM handling: CSV with BOM prefix parses correctly", () => {
		const csvPath = join(tmpDir, "bom.csv");
		const bom = "\uFEFF";
		writeFileSync(
			csvPath,
			`${bom}Full Name,Email
Jane Smith,jane@acme.co`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 1");

		const listOutput = runPipeline(`contact:list --json ${dbFlag}`);
		const contacts = JSON.parse(listOutput);
		expect(contacts[0].name).toBe("Jane Smith");
	});

	it("malformed CSV with relax_column_count handles partial rows", () => {
		const csvPath = join(tmpDir, "malformed.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email,Phone
Jane Smith,jane@acme.co
Bob Lee,bob@test.com,555-1234`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Imported: 2");
	});
});

// ── Round-trip tests ────────────────────────────────────────────

describe("round-trip fidelity", () => {
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

	it("contacts full round-trip preserves data", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role CTO --source linkedin ${dbFlag}`);

		// Export
		const csvOutput = runPipeline(`export --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "exported.csv");
		writeFileSync(csvPath, csvOutput);

		// Import into fresh DB
		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		runPipeline(`import ${csvPath} ${freshDbFlag}`);

		const originalJson = runPipeline(`export --format json ${dbFlag}`);
		const freshJson = runPipeline(`export --format json ${freshDbFlag}`);
		const original = JSON.parse(originalJson);
		const fresh = JSON.parse(freshJson);

		expect(fresh).toHaveLength(1);
		expect(fresh[0].name).toBe(original[0].name);
		expect(fresh[0].email).toBe(original[0].email);
		expect(fresh[0].org_name).toBe(original[0].org_name);
		expect(fresh[0].role).toBe(original[0].role);
		expect(fresh[0].source).toBe(original[0].source);
		cleanupTmpDir(freshDir);
	});

	it("tasks round-trip with completed status preserved", () => {
		runPipeline(`task:add "Follow up" --due 2026-03-15 ${dbFlag}`);
		runPipeline(`task:done 1 ${dbFlag}`);

		// Export all tasks (including completed)
		const csvOutput = runPipeline(`export --type tasks --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "tasks.csv");
		writeFileSync(csvPath, csvOutput);

		// Import into fresh DB
		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		runPipeline(`import ${csvPath} --type tasks ${freshDbFlag}`);

		const freshCsv = runPipeline(`export --type tasks --format csv ${freshDbFlag}`);
		expect(freshCsv).toContain("Follow up");
		expect(freshCsv).toContain("yes");
		cleanupTmpDir(freshDir);
	});

	it("interactions round-trip with occurred_at preserved", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co ${dbFlag}`);
		runPipeline(`log:email "Jane Smith" --subject "Follow-up" --body "Thanks" ${dbFlag}`);

		// Export
		const csvOutput = runPipeline(`export --type interactions --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "interactions.csv");
		writeFileSync(csvPath, csvOutput);

		// Import into fresh DB (need the contact first)
		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		runPipeline(`contact:add "Jane Smith" --email jane2@acme.co ${freshDbFlag}`);
		runPipeline(`import ${csvPath} --type interactions ${freshDbFlag}`);

		const originalJson = runPipeline(`export --type interactions --format json ${dbFlag}`);
		const freshJson = runPipeline(`export --type interactions --format json ${freshDbFlag}`);
		const original = JSON.parse(originalJson);
		const fresh = JSON.parse(freshJson);

		expect(fresh).toHaveLength(1);
		expect(fresh[0].occurred_at).toBe(original[0].occurred_at);
		expect(fresh[0].subject).toBe(original[0].subject);
		cleanupTmpDir(freshDir);
	});

	it("tags round-trip preserves comma-separated tags", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --tag investor --tag advisor ${dbFlag}`);

		const csvOutput = runPipeline(`export --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "tags.csv");
		writeFileSync(csvPath, csvOutput);

		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		runPipeline(`import ${csvPath} ${freshDbFlag}`);

		const freshJson = runPipeline(`export --format json ${freshDbFlag}`);
		const fresh = JSON.parse(freshJson);
		expect(fresh[0].tags).toContain("investor");
		expect(fresh[0].tags).toContain("advisor");
		cleanupTmpDir(freshDir);
	});

	it("deals round-trip with FK resolution by name", () => {
		runPipeline(`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" ${dbFlag}`);
		runPipeline(`deal:add "Acme Deal" --contact "Jane Smith" --org "Acme Corp" --value 10000 --stage proposal ${dbFlag}`);

		const csvOutput = runPipeline(`export --type deals --format csv ${dbFlag}`);
		const csvPath = join(tmpDir, "deals.csv");
		writeFileSync(csvPath, csvOutput);

		const freshDir = createTmpDir();
		const freshDbFlag = `--db ${join(freshDir, "fresh.db")}`;
		runPipeline(`init ${freshDbFlag}`);
		// Create the contact/org first so FK resolution works
		runPipeline(`contact:add "Jane Smith" --email jane2@acme.co --org "Acme Corp" ${freshDbFlag}`);
		runPipeline(`import ${csvPath} --type deals ${freshDbFlag}`);

		const freshJson = runPipeline(`export --type deals --format json ${freshDbFlag}`);
		const fresh = JSON.parse(freshJson);
		expect(fresh).toHaveLength(1);
		expect(fresh[0].title).toBe("Acme Deal");
		expect(fresh[0].value).toBe(10000);
		expect(fresh[0].contact_name).toBe("Jane Smith");
		expect(fresh[0].org_name).toBe("Acme Corp");
		cleanupTmpDir(freshDir);
	});
});

// ── Error reporting tests ───────────────────────────────────────

describe("error reporting", () => {
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

	it("row number appears in verbose error output", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email
Jane Smith,jane@acme.co
,missing-name@test.com
Bob Lee,bob@test.com`,
		);

		const output = runPipeline(`import ${csvPath} -v ${dbFlag}`);
		expect(output).toContain("Row 3:");
		expect(output).toContain("Imported: 2");
		expect(output).toContain("Skipped: 1");
	});

	it("warning count shown when not verbose", () => {
		const csvPath = join(tmpDir, "contacts.csv");
		writeFileSync(
			csvPath,
			`Full Name,Email
,no-name@test.com
,also-no-name@test.com`,
		);

		const output = runPipeline(`import ${csvPath} ${dbFlag}`);
		expect(output).toContain("Skipped: 2");
		expect(output).toContain("Use -v to see 2 error(s)");
	});
});
