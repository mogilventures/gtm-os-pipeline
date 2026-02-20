import { join } from "node:path";
import { writeFileSync } from "node:fs";
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
});
