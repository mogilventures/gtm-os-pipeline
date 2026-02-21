# Pipeline

**A CLI CRM with an AI agent that follows up so you don't have to.**

---

## The Problem

You're a developer-founder. You can build anything — but you can't remember to follow up with Jane about that consulting deal.

Your "CRM" is a mess of starred emails, a half-abandoned Notion table, and a mental note you made in the shower. You know you should be tracking your pipeline. You've tried Hubspot, Pipedrive, even a spreadsheet. They all die the same death: you open them once, enter three contacts, and never go back. Because every CRM is built for sales teams, not for you. They want you to live in their app. You already live somewhere else — your terminal.

Meanwhile, the people who could become your customers, your investors, your partners are slowly going cold. Not because you can't sell. Because you forgot.

---

## What It Looks Like

```
$ pipeline agent "who should I follow up with this week?"

3 contacts need attention:

  Jane Smith (Acme Corp) — last contact 16 days ago, $15k deal in proposal stage
  → follow-up email referencing your last meeting about Q2 timeline

  Bob Lee (Startup.io) — last contact 22 days ago, introduced by Marc
  → casual check-in, mention the AI consulting work he asked about

  Sarah Chen (Sequoia) — last contact 11 days ago, no open deal
  → share your latest product update, she expressed interest

Run `pipeline approve` to review and send.
```

```
$ pipeline related jane

Related to Jane Smith (person):

  Organizations:
    - Acme Corp

  Deals:
    - Acme Consulting (proposal)

  Interactions:
    - [email] Q2 Timeline Discussion (2025-02-05)
    - [meeting] Initial scope call (2025-01-20)
    - [email] Intro from Marc (2025-01-12)

  Edges:
    --[works_at]--> organization: Acme Corp
    <--[introduced_by]-- person: Marc Rivera
```

The agent found Jane, checked her history, drafted a personalized follow-up, and queued it for your approval. One command. You didn't open an app, click through a form, or remember anything.

---

## The Insight

CRMs are broken because they require humans to do the work that AI should be doing: remembering follow-ups, logging interactions, keeping data current. The next generation of CRM doesn't need a better interface — it needs an agent that does the work for you, with a human approving the actions.

But an agent that monitors your email, notices a deal going cold, and drafts a follow-up — that agent needs a system of record to operate against. Not a spreadsheet. Not a JSON file. A structured database with a relationship graph, interaction history, and a schema the agent can query and update through well-defined tools.

And the most natural interface for both a human developer and an AI agent is the same thing: a command line. Text in. Text out. Composable. Scriptable. Pipeable. The CLI is the universal API for humans and machines.

Pipeline is that system of record.

---

## The Product

Pipeline is a CLI-native CRM with an AI agent layer. Built for developer-founders who have contacts that matter — not 10,000 anonymous leads in a funnel, but the 50 or 500 relationships that actually drive their business.

**It's local-first.** A single SQLite file. No server. No account. `npx pipeline init` and you're running. Your data never leaves your machine unless you want it to.

**It's fast.** Every command runs and exits. No spinners, no loading screens, no dashboards to wait for. `pipeline deal list` is instant. You get your answer and go back to work.

**It's a graph, not a spreadsheet.** Your business is a network: people work at companies, companies have deals, deals have interactions, people introduce other people. Pipeline models these relationships as a traversable graph. `pipeline related jane` shows you the full picture — her company, your deal, every email, every meeting, who introduced her — in one command.

**It's AI-native.** An agent with tools that can search your contacts, traverse your relationship graph, and draft contextual follow-ups. Not a chatbot bolted onto a database — an agent operating against a structured system of record through purpose-built MCP tools. Every action it takes is proposed for your approval. You stay in control.

---

## Who It's For

Developer-founders. Solo technical founders. Indie hackers. Freelance engineers selling consulting. Technical co-founders doing BD. Agency owners. Anyone who builds for a living and sells on the side.

People who:
- Have a terminal open all day
- Find Hubspot offensive
- Know they're leaving money on the table by not following up
- Would rather type a command than click through a form
- Are curious about AI agents but don't want to give an AI unsupervised access to their business

---

## Why Not Just X?

**Why not Hubspot/Pipedrive?** You already know. You tried it, entered three contacts, and never went back. It's a web app built for full-time salespeople. You're not one.

**Why not a spreadsheet?** No agent layer. No relationship graph. No follow-up reminders. And you'll abandon it in two weeks for the same reason you abandon every spreadsheet.

**Why not just ask Claude Code to track contacts in a file?** Because Claude Code doesn't persist state between sessions. It has no structured schema, no relationship graph, no approval workflow. Pipeline gives the agent 16 purpose-built MCP tools for CRM operations — searching contacts, traversing relationships, proposing actions. And critically, the agent can only propose, never act. That's the safety guarantee.

---

## Why Now

Three things are converging:

**1. AI agents work now.** Not theoretical — production-ready. Claude's tool-use API and the MCP protocol give us a full agent runtime: structured tool calls, context management, multi-step reasoning. A CRM agent that actually searches your contacts, checks your interaction history, and drafts personalized follow-ups is something you can build in weeks, not years.

**2. Developer-founders are the new sales team.** The rise of solo founders, indie hackers, and small technical teams means more people are selling who were never trained to sell. They need tools shaped for their workflow, not adapted from enterprise sales playbooks.

**3. The terminal is having a moment.** Claude Code, Cursor, Warp, Ghostty, terminal-native AI tools — the command line is no longer a relic. It's where the most productive developers are choosing to work. A CRM that meets them there isn't a compromise, it's a feature.

---

## How It's Different

| | Traditional CRM | Pipeline |
|---|---|---|
| Interface | Web app you have to visit | Terminal commands you run from anywhere |
| Data entry | Manual forms | One-line commands, email sync, agent enrichment |
| Follow-ups | You remember (you won't) | Agent monitors and proposes |
| Data model | Flat tables | Relationship graph with traversal |
| AI | Bolted-on copilot | Native agent with human-in-the-loop approval |
| Data ownership | Their cloud | Your SQLite file |
| Setup | Account, onboarding, trial | `npx pipeline init` |
| Extensibility | Vendor integrations | MCP tools, custom agents, `--json` for scripting |

---

## The Bet

We're betting that the best CRM for a developer is one that doesn't feel like a CRM. It feels like a CLI tool — fast, composable, and out of your way. The human's job becomes reviewing and approving, not data entry and remembering.

We're also betting that AI agents will manage most of the CRM workflow within two years. The system of record should be designed for agent operation from day one. Pipeline is — every feature is accessible through MCP tools, every mutation goes through an approval gate, and the relationship graph gives the agent the context it needs to make good recommendations.

---

## What Success Looks Like

**Month 1:** Open-source launch. A working CLI that does what this document says it does. Early adoption from developer communities. Active GitHub issues from real users.

**Month 3:** First paid tier — cloud sync, scheduled agent runs, managed API keys. Gmail sync. Community-contributed custom agents.

**Month 6:** Interactive terminal mode. Pipeline becomes a full workspace for managing your business, not just a set of commands. Plugin ecosystem.

**Year 1:** Pipeline is the default CRM for technical founders. "I use Pipeline" is a signal, the way "I use Neovim" or "I use Arc" is a signal. The relationship graph is the moat — once your business network is mapped with introductions, affiliations, and interaction history, the switching costs are real. The data gets more valuable over time, and the agent gets smarter with more context.
