import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = join(import.meta.dirname, "..", "bin", "run.js");

export function runPipeline(args: string, env?: Record<string, string>): string {
	return execSync(`node ${BIN} ${args}`, {
		cwd: join(import.meta.dirname, ".."),
		encoding: "utf-8",
		env: { ...process.env, ...env },
		timeout: 15000,
	}).trim();
}

export function createTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "pipeline-test-"));
}

export function cleanupTmpDir(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}
