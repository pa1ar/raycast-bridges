# Bridges

Connect any REST API to Raycast AI — scaffolded by an agent, stored locally, callable from any conversation.

## Vision

Raycast already has a great AI assistant. This extension makes it extensible: connect any REST API or local data source, describe it in plain English, and the AI figures out the setup. The result is a callable tool the AI can use in any future conversation — no manual configuration, no static plugin definitions.

The workflow:

1. **Add Capability** — describe an API in plain English. An agent (Claude) searches the web for the real docs, writes a `config.json` and a `guide.md`, then prompts you to enter your API key securely.
2. **Use it** — ask Raycast AI anything that involves that API. It discovers capabilities, reads the guide once, then makes authenticated requests on your behalf.
3. **Manage** — edit configs, rotate credentials, disable or remove sources from the Manage Capabilities command.

Everything runs locally. Nothing goes to a server.

Inspired by [Craft Agents](https://github.com/craftdocs/craft-agents-oss) (open-source).

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
2. Run **Add Capability** and describe any REST API. If no API key is configured, you'll be prompted to sign in with your Claude account.
3. Optionally, set an Anthropic API key in **Bridges** extension preferences as a fallback.

## State

All data stored at `~/.bridges/sources/{slug}/`:

```
~/.bridges/
├── sources/
│   └── craft-api/
│       ├── config.json          # base URL, auth type, headers
│       ├── guide.md             # API docs injected into Raycast AI
│       └── .credential-cache.json
└── skills/
    └── daily-review/
        └── SKILL.md             # custom skill instructions
```
