import { Command, Flags } from "@oclif/core";

const SKIP_AUDIT = new Set(["audit", "help", "version"]);

const SENSITIVE_FLAGS = new Set([
	"--api-key",
	"--token",
	"--password",
	"--secret",
]);

function sanitizeArgv(argv: string[]): string {
	const sanitized: string[] = [];
	let redactNext = false;
	for (const arg of argv) {
		if (redactNext) {
			sanitized.push("[REDACTED]");
			redactNext = false;
			continue;
		}
		// Handle --flag=value style
		const eqIdx = arg.indexOf("=");
		if (eqIdx !== -1) {
			const flag = arg.slice(0, eqIdx);
			if (SENSITIVE_FLAGS.has(flag)) {
				sanitized.push(`${flag}=[REDACTED]`);
				continue;
			}
		}
		if (SENSITIVE_FLAGS.has(arg)) {
			sanitized.push(arg);
			redactNext = true;
			continue;
		}
		// Truncate long values
		sanitized.push(arg.length > 200 ? `${arg.slice(0, 200)}…` : arg);
	}
	return JSON.stringify(sanitized);
}

function extractDbFlag(argv: string[]): string | undefined {
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--db" && argv[i + 1]) return argv[i + 1];
		if (argv[i].startsWith("--db=")) return argv[i].slice(5);
	}
	return process.env.PIPELINE_DB;
}

export abstract class BaseCommand extends Command {
	static baseFlags = {
		json: Flags.boolean({
			description: "Output as JSON",
			default: false,
		}),
		quiet: Flags.boolean({
			char: "q",
			description: "Minimal output (IDs only)",
			default: false,
		}),
		verbose: Flags.boolean({
			char: "v",
			description: "Verbose output",
			default: false,
		}),
		db: Flags.string({
			description: "Path to database file",
			env: "PIPELINE_DB",
		}),
	};

	private _auditStartTime = 0;
	private _auditError: string | undefined;
	private _auditResult: "success" | "error" = "success";

	async init(): Promise<void> {
		await super.init();
		this._auditStartTime = Date.now();
	}

	protected override async catch(
		err: Error & { exitCode?: number },
	): Promise<void> {
		this._auditResult = "error";
		this._auditError =
			err.message.length > 500 ? `${err.message.slice(0, 500)}…` : err.message;
		throw err;
	}

	protected override async finally(_error: Error | undefined): Promise<void> {
		try {
			const commandId = this.id;
			if (!commandId || SKIP_AUDIT.has(commandId)) return;

			const duration_ms = Date.now() - this._auditStartTime;
			const dbPath = extractDbFlag(this.argv);
			const args = sanitizeArgv(this.argv);

			const { getDb } = await import("./db/index.js");
			const { writeAuditLog } = await import("./services/audit.js");
			const db = getDb(dbPath);
			writeAuditLog(db, {
				actor: "human",
				command: commandId,
				args,
				result: this._auditResult,
				error: this._auditError,
				duration_ms,
			});
		} catch {
			// Audit failures must never break the CLI
		}
	}
}
