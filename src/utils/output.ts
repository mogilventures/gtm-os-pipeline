import chalk from "chalk";
import Table from "cli-table3";

export function formatTable(
	headers: string[],
	rows: (string | number | null | undefined)[][],
): string {
	const table = new Table({
		head: headers.map((h) => chalk.bold(h)),
		style: { head: [], border: [] },
	});
	for (const row of rows) {
		table.push(row.map((cell) => String(cell ?? "")));
	}
	return table.toString();
}

export function formatJson(data: unknown): string {
	return JSON.stringify(data, null, 2);
}
