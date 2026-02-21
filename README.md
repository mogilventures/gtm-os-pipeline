# Pipeline CRM

A local-first, AI-native CLI CRM for developer-founders.

![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Quick Start

```bash
git clone https://github.com/your-org/pipeline-cli.git
cd pipeline-cli
npm install
npm run build
pipeline init
```

## Usage

```bash
# Add a contact and a deal
pipeline contact:add "Jane Smith" --email jane@acme.com --org "Acme Corp"
pipeline deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal

# Ask the agent who needs a follow-up
pipeline agent "who should I follow up with this week?"

# Review and approve the agent's proposed actions
pipeline approve
```

```bash
# Explore the relationship graph
pipeline related jane

# Check your pipeline at a glance
pipeline status
pipeline timeline --days 30
```

## Commands

| Topic | Commands | Description |
|-------|----------|-------------|
| **contact** | `add` `list` `show` `edit` `rm` `tag` `note` | Manage contacts (people + org + CRM metadata) |
| **deal** | `add` `list` `move` `close` `note` `pipeline` | Track deals through stages |
| **org** | `list` `show` `edit` `contacts` | Organizations and their members |
| **task** | `add` `list` `done` | To-dos attached to contacts or deals |
| **log** | `call` `email` `meeting` `list` | Record interactions |
| **email** | `send` `check` `inbox` `thread` | Send and receive email (via Resend) |
| **agent** | *(free-form prompt)* | Chat with the CRM assistant |
| **agent** | `enrich` `follow-up` `digest` `qualify` | Built-in agent workflows |
| **schedule** | `add` `list` `remove` `run` `install` `uninstall` | Automated agent runs via cron |
| **field** | `get` `set` `rm` | Custom fields on any entity |
| **config** | `get` `set` | Read/write configuration |
| **top-level** | `init` `status` `search` `timeline` `related` `link` `unlink` `import` `export` `approve` `dashboard` | Setup, search, graph, data exchange, approvals |

Every command supports `--json` for scripted output and `--help` for details.

## AI Agents

Pipeline ships with four built-in agents:

| Agent | What it does |
|-------|-------------|
| `agent:enrich` | Research a contact and update their records |
| `agent:follow-up` | Find stale contacts and propose follow-up emails |
| `agent:digest` | Morning pipeline briefing and daily summary |
| `agent:qualify` | Assess deal health and suggest next actions |

Run any agent with a free-form prompt:

```bash
pipeline agent "draft an intro email to Sarah about our consulting services"
```

Agents never act directly. Every mutation (send email, update stage, create task, log note, create relationship edge) is inserted into a `pending_actions` queue. You review and approve them:

```bash
pipeline approve          # interactive review
pipeline approve --all    # approve everything
```

Set `ANTHROPIC_API_KEY` in your environment to use agents.

## Scheduled Runs

Automate agents on a recurring schedule:

```bash
pipeline schedule:add follow-up --cron "0 9 * * 1-5"   # weekdays at 9am
pipeline schedule:list
pipeline schedule:remove <id>

# Install/uninstall the cron job that runs due schedules
pipeline schedule:install
pipeline schedule:uninstall
```

`schedule:run` executes all due schedules and is called automatically by the installed cron job.

## Configuration

Two-level TOML config with deep merge:

| File | Scope |
|------|-------|
| `~/.pipeline/config.toml` | Global (user-wide) |
| `./.pipeline/config.toml` | Project-local (overrides global) |

Key settings:

```toml
[pipeline]
stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
currency = "USD"

[agent]
model = "claude-sonnet-4-6"
auto_approve = false

[email]
provider = "resend"
from = "you@yourdomain.com"
resend_api_key = "re_..."
```

Read and write config from the CLI:

```bash
pipeline config:get agent.model
pipeline config:set email.from "you@yourdomain.com"
```

## MCP Server

Pipeline exposes its service layer as an MCP server over stdio, so any MCP-compatible client (IDEs, other agents) can interact with your CRM data.

```bash
node bin/mcp.js --db ~/.pipeline/pipeline.db
```

## Development

```bash
npm run build        # compile TypeScript (required before running)
npm run dev          # watch mode
npm test             # run all integration tests (vitest)
npm run lint         # check with Biome
npm run format       # auto-fix with Biome
```

Architecture, conventions, testing strategy, and schema details are documented in [CLAUDE.md](./CLAUDE.md).

## License

MIT
