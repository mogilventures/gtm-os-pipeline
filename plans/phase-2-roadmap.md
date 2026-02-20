# Phase 2 Roadmap

Ideas for future development, organized by effort and impact. Phase 1 delivered the full local-only MVP: entity CRUD, relationship graph, AI agent layer, and data portability.

---

## Tier 1: Immediate Value (Low Effort, High Payoff)

### Email Sending

The approval workflow already handles `send_email` actions but just logs them. Wire up actual sending so the agent can draft emails, you approve them, and they get sent.

**Scope:**
- Support Resend, AWS SES, or raw SMTP as transport
- Config in `~/.pipeline/config.toml` under `[email]` section (provider, from address, credentials)
- Extend the `send_email` action executor in `src/services/approval.ts` to actually send
- Auto-log sent emails as interactions
- `pipeline email send <contact> --subject --body` for manual sending
- Template support: `pipeline email send <contact> --template follow-up`

**Why now:** The agent already proposes emails. This closes the loop.

---

### Scheduled Agent Runs

The daily digest and follow-up checker are most useful when they run automatically.

**Scope:**
- `pipeline cron install` — generates and installs a crontab entry that runs `agent:digest` and `agent:follow-up` daily
- `pipeline cron remove` — removes the crontab entry
- Output goes to `~/.pipeline/logs/` with timestamped files
- Optional: Slack/email notification with the digest output
- Configurable schedule in `config.toml`

**Why now:** The subagents are built. Scheduling them is a small wrapper with outsized value.

---

### Duplicate Detection & Merge

Import and manual entry easily create duplicate contacts. Need tooling to find and merge them.

**Scope:**
- `pipeline dedupe` — scan contacts for duplicates by email match, fuzzy name match, or same person at same org
- Show grouped duplicates with a diff of fields
- `pipeline merge <id1> <id2>` — merge two contacts, combining interactions/deals/tasks/edges onto the surviving record
- Option to auto-merge exact email matches during import
- Agent tool: `find_duplicates` so the AI can flag them

**Why now:** Data quality degrades fast without this. Import is already live.

---

## Tier 2: Medium Effort, Big Unlock

### TUI Dashboard

Browsing the CRM through individual commands gets tedious. An interactive terminal UI changes the experience entirely.

**Scope:**
- Built with Ink (React for CLI) or blessed/blessed-contrib
- Screens:
  - **Pipeline board** — kanban view of deals, navigate with arrow keys, press Enter to see deal detail
  - **Contact browser** — scrollable list with search, shows detail pane on select
  - **Activity feed** — chronological timeline of all interactions across contacts
  - **Task inbox** — pending tasks and pending agent actions in one view
- Keyboard shortcuts: `j/k` navigation, `/` search, `q` quit, `a` add, `e` edit
- `pipeline ui` or `pipeline dashboard` to launch
- Falls back to static output in non-TTY environments

**Why now:** All the data and services exist. This is a presentation layer over what's already built.

---

### Email Inbox Sync

The biggest friction in the CRM is manually logging interactions. Auto-syncing email removes that.

**Scope:**
- IMAP polling or Gmail API integration
- `pipeline sync email --provider gmail` to configure OAuth flow
- Background sync: polls every N minutes, matches emails to contacts by address
- Auto-creates interactions (type: email, direction inbound/outbound)
- Handles threads — groups related emails
- Config under `[integrations.email]` in config.toml
- `pipeline sync status` to see last sync time and stats

**Why now:** Interaction logging is the most manual part of the workflow. Automating it makes the "stale contact" detection actually reliable.

---

### Analytics & Reporting

Pipeline metrics help founders understand their sales motion.

**Scope:**
- `pipeline analytics` — summary dashboard:
  - Win rate (closed_won / total closed)
  - Average deal velocity (days from lead → closed)
  - Conversion funnel by stage
  - Pipeline value trend (if we add a snapshots table)
  - Activity volume (interactions per week)
- `pipeline analytics --period 30d` — time-scoped metrics
- Sparkline charts in terminal (using spark or cli-sparkline)
- `--json` flag for piping to external tools
- Agent tool: `get_analytics` so the AI can reference metrics in briefings

**Why now:** We have deals with stage history and timestamped interactions. The data is there; we just need to query it.

---

## Tier 3: Longer Term / Ambitious

### Multi-User Sync

Move from single-machine to shared CRM without giving up local-first.

**Scope:**
- Use Turso (libSQL) or LiteFS to replicate SQLite across machines
- `pipeline sync setup` — configure remote database URL
- Conflict resolution strategy (last-write-wins with vector clocks, or CRDT-based)
- Auth layer for multi-user access
- Audit log table tracking who changed what

**Complexity:** High — distributed state is hard. Consider whether a simpler "export → import" workflow between team members is enough first.

---

### Plugin System

Let users extend the CLI with custom commands and integrations.

**Scope:**
- `~/.pipeline/plugins/` directory — each subdirectory is a plugin
- Plugin manifest (`plugin.json`) declaring commands, hooks, and MCP tools
- Plugins can register:
  - New CLI commands (auto-discovered by oclif)
  - New MCP tools (loaded by the MCP server)
  - Lifecycle hooks (on_contact_add, on_deal_move, on_interaction_log)
- `pipeline plugin install <name>` / `pipeline plugin list`
- Built-in plugin examples: Slack notifier, LinkedIn enricher, Stripe revenue sync

**Complexity:** Medium-high — needs careful API design so plugins are stable across versions.

---

### Webhook Triggers

Push notifications when important CRM events happen.

**Scope:**
- `pipeline webhook add <url> --event deal.moved --event contact.stale`
- Events: `deal.moved`, `deal.closed`, `contact.added`, `contact.stale`, `task.overdue`, `action.proposed`
- POST JSON payload to configured URLs
- Retry logic with exponential backoff
- Built-in targets: Slack incoming webhook, Discord webhook, generic HTTP
- `pipeline webhook list` / `pipeline webhook rm <id>`
- Stored in a `webhooks` table in the DB

**Complexity:** Medium — straightforward HTTP but needs reliability and event system.

---

### LinkedIn Enrichment

Auto-enrich contact profiles from LinkedIn.

**Scope:**
- `pipeline enrich <contact>` — look up LinkedIn profile, fill in role, company, location, profile URL
- Uses LinkedIn API (requires OAuth) or a third-party enrichment API (Proxycurl, Apollo, etc.)
- Batch mode: `pipeline enrich --all --empty-fields` to fill gaps across all contacts
- Agent integration: the `enrich` subagent already exists, this gives it real data sources
- Rate limiting and caching to avoid API quota issues

**Complexity:** Medium — LinkedIn's API is restrictive. Third-party APIs cost money.

---

## Priority Recommendation

If building sequentially, this order maximizes value:

1. **Email sending** — closes the agent → approval → action loop
2. **Scheduled agent runs** — makes the AI proactive instead of reactive
3. **Duplicate detection** — data hygiene before the DB grows
4. **Analytics** — gives founders visibility into their pipeline health
5. **TUI dashboard** — transforms the daily workflow experience
6. **Email inbox sync** — eliminates manual interaction logging
7. **Webhooks** — enables integrations without plugins
8. **Plugin system** — opens up community contributions
9. **LinkedIn enrichment** — depends on API access / budget
10. **Multi-user sync** — only needed when team grows beyond one
