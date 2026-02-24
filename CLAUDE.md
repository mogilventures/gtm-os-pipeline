# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

A local-first, AI-native CLI CRM for developer-founders. Built with oclif v4, TypeScript (ESM), SQLite (via better-sqlite3 + Drizzle ORM). Agents propose actions via MCP tools; humans approve them before execution.

## Commands

```bash
npm run build                    # Compile TypeScript (required before running CLI or MCP server)
npm run dev                      # Watch mode
npm test                         # Run all integration tests (vitest)
npx vitest run test/commands/email.test.ts  # Run a single test file
npx vitest run -t "email:send"   # Run tests matching a name pattern
npm run lint                     # Check with Biome
npm run format                   # Auto-fix with Biome
```

## Architecture

Four layers, strictly separated:

```
CLI Commands (src/commands/)  ──→  Services (src/services/)  ──→  DB (src/db/)
MCP Server  (src/mcp/)       ──→  Services (src/services/)  ──→  DB (src/db/)
```

**Commands** parse flags/args and format output. They never touch the DB directly — all data access goes through services.

**Services** are pure functions accepting a `PipelineDB` instance. No oclif dependency. Each file covers one domain: contacts, deals, organizations, tasks, interactions, graph, email, email-sync, approval, agent-runner, subagents, search, timeline, dashboard, custom-fields.

**MCP Server** (`src/mcp/server.ts`) runs as a separate process (`bin/mcp.js`), wraps service functions as MCP tools over stdio. The agent-runner spawns this as a child process via `StdioClientTransport`.

**DB** (`src/db/index.ts`) is a module-level singleton (`getDb()` caches per-process). Migrations are purely additive `CREATE TABLE IF NOT EXISTS` + try/catch `ALTER TABLE` — no migration tool.

### Key Patterns

- **BaseCommand**: All commands extend `BaseCommand` which provides `--json`, `-q`, `-v`, `--db` flags. Every command starts with `const { args, flags } = await this.parse(...)` then `const db = getDb(flags.db)`.
- **Fuzzy resolve**: `fuzzyResolve()` in `src/utils/fuzzy.ts` tries exact match → Fuse.js fuzzy → interactive picker (TTY) or best match (piped). Each entity has a `getXxxForFuzzy(db)` returning `{id, name}[]`.
- **Agent loop**: `runAgent()` in `src/services/agent-runner.ts` spawns `bin/mcp.js`, creates an MCP client, and loops Claude API calls until `stop_reason === "end_turn"` with no tool calls. Agents never act directly — they call `propose_action` to insert into `pending_actions`.
- **Approval workflow**: `pipeline approve` routes `pending_actions` by `action_type` (`send_email`, `update_stage`, `create_task`, `log_note`, `create_edge`). `approveAction()` is async due to email sending.
- **Config**: Two-level TOML (`~/.pipeline/config.toml` + `./.pipeline/config.toml`) with deep merge. Sections: `pipeline`, `agent`, `email`.

## Conventions

- **ESM**: `"type": "module"` — all imports use `.js` extensions.
- **Strict TypeScript**: `module: Node16`, `target: ES2022`, strict mode.
- **Biome**: tabs for indentation, recommended lint rules. Run `npm run format` before committing.
- **Dynamic imports**: Heavy optional deps (`@anthropic-ai/sdk`, `@composio/core`) are loaded via `await import()` so the CLI stays fast for non-email/agent commands.

## Testing

Tests are **integration-style**: they run the real CLI binary via `execSync` and assert on stdout + DB state. No mocking.

- `test/helpers.ts` provides `runPipeline(args, env?)`, `createTmpDir()`, `cleanupTmpDir()`.
- Each test creates a temp dir with its own DB via `--db /tmp/pipeline-test-xxx/test.db`.
- For data that requires external services (email, Composio), tests insert synthetic rows directly via `better-sqlite3`.
- MCP tests (`test/commands/mcp.test.ts`) spawn the MCP server as a child process and call tools via `@modelcontextprotocol/sdk` client.
- Vitest config: 30-second timeouts (needed since each assertion spawns a node process).

## Schema

Eight tables in `src/db/schema.ts`: `people`, `organizations`, `contacts` (junction: person + org + CRM metadata), `deals`, `interactions`, `tasks`, `pending_actions`, `custom_fields`, `edges`. The `contacts` table is the central entity — most FK references point to `contacts.id`, not `people.id`.
