import Table from "cli-table3";
import chalk from "chalk";

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

export function outputResult(
	data: unknown,
	opts: { json?: boolean; quiet?: boolean },
	headers?: string[],
	toRow?: (item: unknown) => (string | number | null | undefined)[],
): string {
	if (opts.json) {
		return formatJson(data);
	}

	if (opts.quiet && Array.isArray(data)) {
		return data
			.map((item: Record<string, unknown>) => item.id ?? item.name ?? "")
			.join("\n");
	}

	if (headers && toRow && Array.isArray(data)) {
		return formatTable(
			headers,
			data.map((item) => toRow(item)),
		);
	}

	return typeof data === "string" ? data : formatJson(data);
}
