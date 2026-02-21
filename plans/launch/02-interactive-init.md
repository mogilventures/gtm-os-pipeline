# Spec: Interactive Init Experience

**Priority:** P1 — First impression. The gap between `npx @gtm-os/pipeline init` and a working agent demo must be zero friction.

**Scope:** Make `pipeline init` an interactive, guided setup that walks the user through API keys, email config, and optionally seeds sample data. The existing non-interactive behavior stays as `pipeline init --quick`.

---

## 1. Current State

**File:** `src/commands/init.ts`

The current `init` command (39 lines) does three things:
1. Creates `~/.pipeline/config.toml` with defaults (if missing)
2. Creates the SQLite database (if missing)
3. Prints paths and exits

There are no prompts, no API key setup, no validation. A user who runs `pipeline init` then `pipeline agent:follow-up` will get an `ANTHROPIC_API_KEY` error with no guidance on what to do next.

---

## 2. Rewrite `pipeline init` as Interactive

**File:** `src/commands/init.ts`

Replace the entire file:

```typescript
import { existsSync } from "node:fs";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import {
	getConfigPath,
	getDefaultConfig,
	getPipelineDir,
	loadConfig,
	saveConfig,
	setConfigValue,
} from "../config.js";
import { getDb, getDbPath } from "../db/index.js";

export default class Init extends BaseCommand {
	static override description = "Initialize Pipeline CRM (creates ~/.pipeline/ with DB and config)";

	static override examples = [
		"<%= config.bin %> init",
		"<%= config.bin %> init --quick",
	];

	static override flags = {
		...BaseCommand.baseFlags,
		quick: Flags.boolean({
			description: "Skip interactive setup, just create files",
			default: false,
		}),
		seed: Flags.boolean({
			description: "Seed sample data for demo",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Init);

		const dir = getPipelineDir();
		const configPath = getConfigPath();
		const dbPath = getDbPath(flags.db);

		// Step 1: Create config
		const isNewSetup = !existsSync(configPath);
		if (isNewSetup) {
			const config = getDefaultConfig();
			saveConfig(config);
			this.log(`Created config: ${configPath}`);
		} else {
			this.log(`Config already exists: ${configPath}`);
		}

		// Step 2: Create database
		if (!existsSync(dbPath)) {
			getDb(flags.db);
			this.log(`Created database: ${dbPath}`);
		} else {
			getDb(flags.db);
			this.log(`Database already exists: ${dbPath}`);
		}

		// Step 3: Interactive setup (unless --quick)
		if (!flags.quick && isNewSetup && process.stdin.isTTY) {
			await this.interactiveSetup(flags.db);
		}

		// Step 4: Seed sample data (if requested or chosen during interactive)
		if (flags.seed) {
			this.seedSampleData(flags.db);
		}

		this.log(`\nPipeline initialized at ${dir}`);
		this.log("Run `pipeline status` to see your CRM.");
		this.log("Run `pipeline dashboard` for your pipeline overview.");

		if (isNewSetup) {
			this.log("\nQuick start:");
			this.log('  pipeline contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp"');
			this.log('  pipeline deal:add "Acme Consulting" --contact jane --value 15000');
			this.log('  pipeline agent "summarize my pipeline"');
		}
	}

	private async interactiveSetup(dbPath?: string): Promise<void> {
		const { input, select, confirm } = await import("@inquirer/prompts");
		const config = loadConfig();

		this.log("\n--- Pipeline Setup ---\n");

		// Anthropic API Key
		const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
		if (hasAnthropicKey) {
			this.log("Anthropic API key: detected from environment (ANTHROPIC_API_KEY)");
		} else {
			this.log("The AI agent requires an Anthropic API key.");
			this.log("Get one at: https://console.anthropic.com/settings/keys\n");

			const setupKey = await confirm({
				message: "Set up Anthropic API key now?",
				default: true,
			});

			if (setupKey) {
				const key = await input({
					message: "Anthropic API key (sk-ant-...):",
					validate: (val) => {
						if (!val.startsWith("sk-ant-")) return "Key should start with sk-ant-";
						return true;
					},
				});

				// Write to shell profile
				this.log(`\nAdd this to your shell profile (~/.zshrc or ~/.bashrc):`);
				this.log(`  export ANTHROPIC_API_KEY=${key}\n`);
				this.log("Then restart your terminal or run: source ~/.zshrc");
			} else {
				this.log("Skipped. Set ANTHROPIC_API_KEY in your environment when ready.");
			}
		}

		// Email setup
		this.log("");
		const setupEmail = await confirm({
			message: "Set up email sending? (Resend — lets the agent send follow-ups)",
			default: false,
		});

		if (setupEmail) {
			this.log("Get a Resend API key at: https://resend.com/api-keys\n");

			const resendKey = await input({
				message: "Resend API key (re_...):",
				validate: (val) => {
					if (!val.startsWith("re_")) return "Key should start with re_";
					return true;
				},
			});

			const fromAddress = await input({
				message: "Send emails from (e.g. you@yourdomain.com):",
				validate: (val) => {
					if (!val.includes("@")) return "Must be a valid email address";
					return true;
				},
			});

			setConfigValue(config, "email.provider", "resend");
			setConfigValue(config, "email.from", fromAddress);
			setConfigValue(config, "email.resend_api_key", resendKey);
			saveConfig(config);
			this.log("Email configured.");
		}

		// AI model preference
		this.log("");
		const model = await select({
			message: "AI model for agent commands:",
			choices: [
				{ name: "claude-sonnet-4-6 (recommended — fast and capable)", value: "claude-sonnet-4-6" },
				{ name: "claude-haiku-4-5 (cheaper, faster, less capable)", value: "claude-haiku-4-5-20251001" },
				{ name: "claude-opus-4-6 (most capable, slower)", value: "claude-opus-4-6" },
			],
		});

		if (model !== "claude-sonnet-4-6") {
			setConfigValue(config, "agent.model", model);
			saveConfig(config);
		}

		// Seed data
		const wantSeed = await confirm({
			message: "Add sample contacts/deals for demo? (can be deleted later)",
			default: true,
		});

		if (wantSeed) {
			this.seedSampleData(dbPath);
		}

		this.log("\n--- Setup complete ---");
	}

	private seedSampleData(dbPath?: string): void {
		const db = getDb(dbPath);

		// Check if data already exists
		const { schema } = require("../db/index.js");
		const existingContacts = db.select().from(schema.contacts).all();
		if (existingContacts.length > 0) {
			this.log("Database already has contacts, skipping seed.");
			return;
		}

		// Seed via CLI commands to exercise the full stack
		const { execSync } = require("node:child_process");
		const BIN = new URL("../../bin/run.js", import.meta.url).pathname;
		const flag = dbPath ? `--db ${dbPath}` : "";

		const commands = [
			`contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role "VP Engineering" --warmth hot --tag prospect ${flag}`,
			`contact:add "Bob Lee" --email bob@startup.io --org "Startup.io" --role "CTO" --warmth warm --tag referral ${flag}`,
			`contact:add "Sarah Chen" --email sarah@sequoia.com --org "Sequoia Capital" --role "Partner" --warmth warm --tag investor ${flag}`,
			`deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal ${flag}`,
			`deal:add "Startup.io Advisory" --contact bob --value 5000 --stage qualified ${flag}`,
			`log:email jane --direction outbound --subject "Q2 Timeline Discussion" --body "Discussed Q2 priorities and consulting engagement timeline." ${flag}`,
			`log:meeting bob --body "Introductory call about AI consulting needs." ${flag}`,
			`task:add "Send Acme proposal" --contact jane --due 7d ${flag}`,
			`link jane --works-at "Acme Corp" ${flag}`,
			`link bob --introduced-by jane ${flag}`,
		];

		for (const cmd of commands) {
			try {
				execSync(`node ${BIN} ${cmd}`, { stdio: "ignore" });
			} catch {
				// Ignore errors from seed (e.g. duplicate orgs)
			}
		}

		this.log("Seeded 3 sample contacts, 2 deals, and sample interactions.");
	}
}
```

---

## 3. Note on `seedSampleData` Implementation

The seed function above uses `execSync` to run CLI commands. This is intentional:
- Exercises the full command stack (validation, service layer, DB)
- Avoids importing and calling service functions directly (keeps init loosely coupled)
- Same approach used by the test suite (`runPipeline()` helper)

**Alternative:** If the `execSync` approach feels heavy, a lighter version would import service functions directly:

```typescript
import { addContact } from "../services/contacts.js";
import { addDeal } from "../services/deals.js";
// etc.
```

This is cleaner but creates a tighter coupling. Either approach works — pick based on preference.

---

## 4. Package Configuration for `npx`

**File:** `package.json`

Change the package name and verify bin entry:

```json
{
  "name": "@gtm-os/pipeline",
  "version": "0.1.0",
  "description": "AI-native CLI CRM for developer-founders",
  "bin": {
    "pipeline": "./bin/run.js",
    "pipeline-crm-mcp": "./bin/mcp.js"
  },
  "files": [
    "/bin",
    "/dist"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

Key changes:
- `name`: `"pipeline-cli"` → `"@gtm-os/pipeline"`
- Add `publishConfig.access`: `"public"` (required for scoped packages on npm)

Users install with:
```bash
npx @gtm-os/pipeline init
# or
npm install -g @gtm-os/pipeline
pipeline init
```

**Important:** The `postinstall` script (`"npm run build || true"`) is needed for source installs but will cause issues with `npx`. The `files` array already limits what gets published to `/bin` and `/dist`, so `postinstall` should only run the build if `dist/` doesn't exist:

```json
"postinstall": "test -d dist || npm run build || true"
```

---

## 5. Testing

### Interactive Init Tests

**File:** `test/commands/config.test.ts`

Add these test cases (interactive mode can't be tested via `runPipeline` since it needs TTY, so test the `--quick` and `--seed` paths):

```typescript
it("init --quick skips interactive setup", () => {
	const output = runPipeline(`init --quick ${dbFlag}`);
	expect(output).toContain("Pipeline initialized");
	// Should not contain any prompt-related output
	expect(output).not.toContain("Setup");
});

it("init --seed creates sample data", () => {
	runPipeline(`init --seed ${dbFlag}`);

	const contacts = runPipeline(`contact:list --json ${dbFlag}`);
	const parsed = JSON.parse(contacts);
	expect(parsed.length).toBeGreaterThanOrEqual(3);

	const deals = runPipeline(`deal:list --json ${dbFlag}`);
	const dealsParsed = JSON.parse(deals);
	expect(dealsParsed.length).toBeGreaterThanOrEqual(2);
});

it("init --seed is idempotent", () => {
	runPipeline(`init --seed ${dbFlag}`);
	// Run again — should not duplicate
	runPipeline(`init --seed ${dbFlag}`);

	const contacts = runPipeline(`contact:list --json ${dbFlag}`);
	const parsed = JSON.parse(contacts);
	// Should still be 3, not 6
	expect(parsed.length).toBe(3);
});
```

### Manual Test: Full Interactive Flow

```bash
# 1. Clean slate
rm -rf ~/.pipeline

# 2. Run interactive init
pipeline init
# Expected flow:
#   Created config: ~/.pipeline/config.toml
#   Created database: ~/.pipeline/pipeline.db
#
#   --- Pipeline Setup ---
#
#   Anthropic API key: detected from environment (ANTHROPIC_API_KEY)
#   [or prompts for key if not set]
#
#   ? Set up email sending? (Resend) No
#   ? AI model for agent commands: claude-sonnet-4-6
#   ? Add sample contacts/deals for demo? Yes
#   Seeded 3 sample contacts, 2 deals, and sample interactions.
#
#   --- Setup complete ---
#
#   Pipeline initialized at /Users/you/.pipeline
#   Run `pipeline status` to see your CRM.
#   Run `pipeline dashboard` for your pipeline overview.

# 3. Verify
pipeline status
# Expected: contacts: 3, deals: 2, etc.

pipeline dashboard
# Expected: pipeline value, active deals, sample tasks

# 4. Agent should work immediately
pipeline agent "summarize my pipeline"
# Expected: real output about Jane, Bob, Sarah and their deals
```

---

## 6. Files Changed Summary

| File | Change |
|---|---|
| `src/commands/init.ts` | Rewrite with interactive prompts, `--quick` flag, `--seed` flag |
| `package.json` | Rename to `@gtm-os/pipeline`, add `publishConfig`, fix `postinstall` |
| `test/commands/config.test.ts` | Add `--quick` and `--seed` test cases |
