# Spec: README and Demo Recording

**Priority:** P1 — The README is the first thing anyone sees on GitHub. The demo GIF is the single most persuasive artifact. Without them, a visitor decides "not for me" in 3 seconds.

**Scope:** Write the README. Create a VHS tape file that records the hero demo scenario. The README embeds the generated GIF.

---

## 1. VHS Setup

[VHS](https://github.com/charmbracelet/vhs) generates terminal GIFs from `.tape` scripts. Install:

```bash
brew install vhs
```

---

## 2. VHS Tape File

**New file:** `demo/demo.tape`

This records the hero scenario from the thesis: agent follow-up recommendations, then approval.

```tape
# Pipeline CLI Demo
# Generates: demo/demo.gif

Output demo/demo.gif

Set Shell "zsh"
Set FontSize 16
Set Width 1200
Set Height 800
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms
Set PlaybackSpeed 1

# Title card
Type "# Pipeline — CLI CRM for developer-founders"
Enter
Sleep 1s

# Show status
Type "pipeline status"
Enter
Sleep 2s

# Show the dashboard
Type "pipeline dashboard"
Enter
Sleep 3s

# Run agent follow-up — the hero demo
Type 'pipeline agent "who should I follow up with this week?"'
Enter
Sleep 8s

# Show pending actions
Type "pipeline approve --list"
Enter
Sleep 3s

# Approve all
Type "pipeline approve --all"
Enter
Sleep 3s

# Show the relationship graph
Type "pipeline related jane"
Enter
Sleep 3s

Sleep 2s
```

**Important:** The tape file assumes:
- Pipeline is installed and initialized with `--seed` data
- `ANTHROPIC_API_KEY` is set (the agent command makes a real API call)
- Email is configured (or the demo shows the "logged as draft" fallback)

The agent response is live — it will vary between recordings. To get a clean demo, run it a few times and pick the best take, or use a pre-seeded database with interactions that make the agent output predictable.

---

## 3. Demo Setup Script

**New file:** `demo/setup.sh`

Prepares a clean environment for recording:

```bash
#!/bin/bash
# Setup script for demo recording
# Run this before `vhs demo/demo.tape`

set -e

# Clean previous setup
rm -rf ~/.pipeline

# Initialize with seed data
pipeline init --quick --seed

# Add some interaction history to make the agent output richer
# (backdate interactions so contacts appear "stale")
DB=~/.pipeline/pipeline.db

# Make Jane's last interaction 16 days ago
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-16 days') WHERE id = 1;"
sqlite3 "$DB" "UPDATE interactions SET occurred_at = datetime('now', '-16 days') WHERE contact_id = 1;"

# Make Bob's last interaction 22 days ago
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-22 days') WHERE id = 2;"
sqlite3 "$DB" "UPDATE interactions SET occurred_at = datetime('now', '-22 days') WHERE contact_id = 2;"

# Make Sarah's last interaction 11 days ago
sqlite3 "$DB" "UPDATE contacts SET updated_at = datetime('now', '-11 days') WHERE id = 3;"

echo "Demo environment ready. Run: vhs demo/demo.tape"
```

```bash
chmod +x demo/setup.sh
```

---

## 4. README

**File:** `README.md`

```markdown
# Pipeline

**Your pipeline, in your terminal. AI that follows up so you don't forget.**

![Pipeline Demo](demo/demo.gif)

Pipeline is a CLI-native CRM with an AI agent layer. Built for developer-founders who have 20–200 contacts that matter, not 10,000.

- **Local-first.** A single SQLite file. No server. No account. Your data never leaves your machine.
- **Fast.** Every command runs and exits. No spinners, no dashboards, no loading screens.
- **AI-native.** An agent that searches your contacts, traverses your relationship graph, and drafts contextual follow-ups. Every action is proposed for your approval.
- **A graph, not a spreadsheet.** People work at companies, companies have deals, people introduce people. `pipeline related jane` shows the full picture.

---

## Install

```bash
npm install -g @gtm-os/pipeline
pipeline init
```

Or try without installing:

```bash
npx @gtm-os/pipeline init
```

Requires Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/settings/keys) for agent features.

---

## Quick Start

```bash
# Add contacts
pipeline contact:add "Jane Smith" --email jane@acme.co --org "Acme Corp" --role "VP Eng"
pipeline contact:add "Bob Lee" --email bob@startup.io --warmth warm

# Create a deal
pipeline deal:add "Acme Consulting" --contact jane --value 15000 --stage proposal

# Log interactions
pipeline log:email jane --direction outbound --subject "Q2 Timeline"
pipeline log:meeting bob --body "Intro call about AI advisory"

# See your pipeline
pipeline dashboard
pipeline deal:pipeline
```

---

## AI Agent

Ask questions about your pipeline in natural language:

```bash
pipeline agent "who should I follow up with this week?"
pipeline agent "summarize my pipeline"
pipeline agent "what's the status of the Acme deal?"
```

Specialized agents for common workflows:

```bash
pipeline agent:follow-up          # Find stale contacts, propose follow-up emails
pipeline agent:digest              # Morning pipeline briefing
pipeline agent:enrich jane         # Research and update a contact's profile
pipeline agent:qualify "Acme deal" # Score a deal's health (1-10)
```

The agent proposes actions. You review and approve:

```bash
pipeline approve         # Interactive review (approve/reject/skip each)
pipeline approve --list  # See what's pending
pipeline approve --all   # Approve everything
```

---

## Relationship Graph

Pipeline models your business as a network, not a flat table:

```bash
# Create relationships
pipeline link jane --works-at "Acme Corp"
pipeline link bob --introduced-by jane

# Traverse the graph
pipeline related jane
# Shows: her org, your deal, every interaction, who introduced her, connected tasks
```

---

## All Commands

| Area | Commands |
|---|---|
| **Contacts** | `contact:add`, `contact:list`, `contact:show`, `contact:edit`, `contact:tag`, `contact:note`, `contact:rm` |
| **Deals** | `deal:add`, `deal:list`, `deal:move`, `deal:close`, `deal:note`, `deal:pipeline` |
| **Organizations** | `org:add`, `org:list`, `org:show`, `org:edit`, `org:contacts` |
| **Interactions** | `log:email`, `log:call`, `log:meeting`, `log:list` |
| **Tasks** | `task:add`, `task:list`, `task:done` |
| **Graph** | `link`, `unlink`, `related` |
| **Search** | `search`, `timeline` |
| **AI Agent** | `agent`, `agent:follow-up`, `agent:digest`, `agent:enrich`, `agent:qualify` |
| **Approval** | `approve` |
| **Data** | `import`, `export`, `field:set`, `field:get`, `field:rm` |
| **Config** | `init`, `status`, `dashboard`, `config:get`, `config:set` |

Every command supports `--json` for scripting and `--help` for docs.

---

## Email Sending

Configure Resend to let the agent send follow-up emails:

```bash
pipeline config:set email.provider resend
pipeline config:set email.from you@yourdomain.com
pipeline config:set email.resend_api_key re_xxxxxxxxxxxx
```

Or send manually:

```bash
pipeline email:send jane --subject "Quick follow-up" --body "Hey Jane, checking in on Q2..."
```

---

## MCP Server

Pipeline includes an [MCP](https://modelcontextprotocol.io/) server, so any MCP-compatible AI client (Claude Desktop, etc.) can read and write your CRM data.

```json
{
  "mcpServers": {
    "pipeline-crm": {
      "command": "pipeline-crm-mcp",
      "args": []
    }
  }
}
```

---

## Custom Agents

Drop a `.md` file in `~/.pipeline/agents/` to create custom agents:

```markdown
# Weekly report generator
Generate a weekly summary of pipeline activity.
1. Use list_deals to get all active deals
2. Use get_stale_contacts to find contacts needing attention
3. Format as a weekly report with sections for wins, risks, and action items
```

```bash
pipeline agent:weekly-report  # Uses your custom agent
```

---

## Configuration

Global config: `~/.pipeline/config.toml`

```toml
[pipeline]
stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]
currency = "USD"

[agent]
model = "claude-sonnet-4-6"

[email]
provider = "resend"
from = "you@yourdomain.com"
resend_api_key = "re_xxxxxxxxxxxx"
```

Project-level overrides: `.pipeline/config.toml` in any directory.

---

## Data

Your data lives in a single SQLite file at `~/.pipeline/pipeline.db`. Back it up, copy it, query it directly — it's yours.

```bash
pipeline export --format csv > contacts.csv   # Export
pipeline import contacts.csv                   # Import from CSV
```

---

## License

MIT
```

---

## 5. Testing

### README Accuracy Checklist

Every command shown in the README must be tested by running it against a seeded database:

```bash
# Seed
pipeline init --quick --seed

# Test every example from Quick Start section
pipeline contact:add "Test Person" --email test@example.com --org "TestCo" --role "CEO"
pipeline deal:add "Test Deal" --contact "Test Person" --value 10000 --stage lead
pipeline log:email "Test Person" --direction outbound --subject "Hello"
pipeline dashboard
pipeline deal:pipeline

# Test agent commands (require ANTHROPIC_API_KEY)
pipeline agent "summarize my pipeline"
pipeline agent:follow-up
pipeline agent:digest
pipeline approve --list

# Test graph commands
pipeline link "Test Person" --works-at "TestCo"
pipeline related "Test Person"

# Test search
pipeline search "Test"
pipeline timeline

# Test export/import
pipeline export --format csv > /tmp/test-export.csv
pipeline export --format json > /tmp/test-export.json

# Test config
pipeline config:get agent.model
pipeline config:set agent.model claude-sonnet-4-6
```

Every command should produce clean output with no errors or stack traces. Any command that fails should be fixed before the README is published.

### VHS Recording Test

```bash
# Setup
./demo/setup.sh

# Record
vhs demo/demo.tape

# Verify
open demo/demo.gif
# Check: readable text, good pacing, agent output makes sense
```

---

## 6. Files Changed Summary

| File | Change |
|---|---|
| `README.md` | **New** — full README with install, quickstart, all commands, config docs |
| `demo/demo.tape` | **New** — VHS tape for hero demo GIF |
| `demo/setup.sh` | **New** — setup script for demo recording environment |
