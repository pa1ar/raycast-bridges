# Bridges

Connect any REST API, MCP server, or CLI tool to Raycast AI — scaffolded by an agent, stored locally, callable from any conversation.

## Vision

Raycast already has a great AI assistant. This extension makes it extensible: connect any REST API, MCP server, or shell CLI, describe it in plain English, and the AI figures out the setup. The result is a callable tool the AI can use in any future conversation — no manual configuration, no static plugin definitions.

The workflow:

1. **Add Capability** — describe an API, MCP server, CLI tool, or skill in plain English. An agent (Claude) searches the web for real docs, writes a config and a guide, then prompts you for credentials if needed.
2. **Use it** — ask Raycast AI anything that involves that capability. It discovers capabilities via keyword search, reads the guide once, then makes authenticated requests or executes commands on your behalf.
3. **Manage** — edit configs, rotate credentials, disable or remove capabilities from the Manage Capabilities command.

Everything runs locally. Nothing goes to a server.

Inspired by [Craft Agents](https://github.com/lukilabs/craft-agents-oss) (open-source).

## Capability Types

| Type | What it does | Examples |
|------|-------------|----------|
| **API Source** | Authenticated REST API calls | Craft API, GitHub API, Stripe |
| **MCP Server** | Model Context Protocol servers (stdio or remote) | GitHub MCP, Craft MCP |
| **CLI Tool** | Shell CLI execution (30s timeout, 50KB output) | gh, vercel, kubectl, yt-dlp |
| **Skill** | AI instructions referencing other capabilities | "Review my daily notes" |

## Prerequisites

- [Raycast](https://raycast.com) with AI enabled
- [Claude CLI](https://claude.ai/download) installed (used by the scaffolding agent)
- **Auth (one of):**
  - A Claude account (Max or Pro subscription) — sign in via OAuth when prompted
  - An [Anthropic API key](https://console.anthropic.com/) — set in extension preferences

## Setup

1. Clone and open in Raycast dev mode:
   ```sh
   cd raycast-bridges
   npm install
   npm run dev
   ```
2. Run **Add Capability** and describe any API, MCP server, or CLI tool. If no API key is configured, you'll be prompted to sign in with your Claude account.
3. Optionally, set an Anthropic API key in **Bridges** extension preferences as a fallback.

## AI Tools

Four tools are registered in Raycast AI, used automatically in conversations:

| Tool | Purpose |
|------|---------|
| `search-capabilities` | Keyword search across names, descriptions, and guides. Called first. |
| `list-capabilities` | Lists all installed capabilities. Fallback when search returns nothing. |
| `get-capability-guide` | Loads full documentation for a capability. Called once per conversation. |
| `call-capability` | Executes: REST API calls, MCP pseudo-paths (`/tools`, `/tools/<tool>/call`), or CLI commands (subcommand+flags as path). |

## State

All data stored at `~/.bridges/`:

```
~/.bridges/
├── sources/
│   └── craft-api/
│       ├── config.json
│       ├── guide.md
│       └── .credential-cache.json
├── mcps/
│   └── github-mcp/
│       ├── config.json
│       ├── guide.md
│       └── .credential-cache.json
├── clis/
│   └── github-cli/
│       ├── config.json
│       └── guide.md
└── skills/
    └── daily-review/
        └── SKILL.md
```
