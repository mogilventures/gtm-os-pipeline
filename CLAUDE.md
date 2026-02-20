# Pipeline CLI — Project Conventions

## What is this?
A local-first, AI-native CLI CRM for developer-founders. Built with oclif v4, TypeScript (ESM), SQLite (via better-sqlite3 + Drizzle ORM).

## Commands
```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run integration tests (vitest)
npm run lint     # Check with Biome
npm run format   # Auto-fix with Biome
```

## Architecture
- `src/commands/` — oclif commands (auto-discovered by filename pattern)
- `src/db/` — Drizzle schema, migrations, database initialization
- `src/services/` — Business logic (contacts, deals, orgs, etc.)
- `src/utils/` — Shared utilities (fuzzy search, output formatting, dates)
- `src/mcp/` — MCP server for AI agent integration
- `src/base-command.ts` — Base class for all commands (global flags)
- `test/` — Integration tests (CLI → output + DB state)
- `bin/run.js` — CLI entry point
- `bin/mcp.js` — MCP server entry point

## Conventions
- ESM modules (import/export, `.js` extensions in imports)
- Strict TypeScript
- Biome for linting/formatting (tabs, recommended rules)
- Tests are integration-style: run the CLI binary and assert on output + DB state
- Use `test/helpers.ts` for `runPipeline()` helper and temp dir management
- Database path defaults to `~/.pipeline/pipeline.db`, override with `--db` flag
- Config at `~/.pipeline/config.toml`

## Key Dependencies
- `@oclif/core` — CLI framework
- `better-sqlite3` + `drizzle-orm` — Database
- `fuse.js` — Fuzzy matching
- `@inquirer/prompts` — Interactive prompts
- `chalk` + `cli-table3` — Terminal output
- `smol-toml` — Config parsing
- `@modelcontextprotocol/sdk` — MCP server
