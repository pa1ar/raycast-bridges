# Raycast Agents

Expand Raycast AI with custom API connections — scaffolded by an AI agent, stored locally, callable from any Raycast AI conversation.

## Vision

Raycast already has a great AI assistant. This extension makes it extensible: connect any REST API or local data source, describe it in plain English, and the AI figures out the setup. The result is a callable tool the AI can use in any future conversation — no manual configuration, no static plugin definitions.

The workflow:

1. **Add Capability** — describe an API in plain English. An agent (Claude) searches the web for the real docs, writes a `config.json` and a `guide.md`, then prompts you to enter your API key securely.
2. **Use it** — ask Raycast AI anything that involves that API. It discovers capabilities, reads the guide once, then makes authenticated requests on your behalf.
3. **Manage** — edit configs, rotate credentials, disable or remove sources from the Manage Capabilities command.

Everything runs locally. Nothing goes to a server. Not intended for the Raycast Store.

## Inspiration

Heavily inspired by [Craft Agents](https://github.com/craftdocs/craft-agents-oss) (open-source) — same `sources/` folder structure, same `config.json` + `guide.md` pattern, same agentic scaffolding approach. We stripped the Electron shell and replaced it with Raycast as the UI layer.

## Stack

- [Raycast API](https://developers.raycast.com) — extension framework, AI tools
- [Anthropic Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) — agentic scaffolding loop
- TypeScript + Bun

## State

All data stored at `~/.raycast-agents/sources/{slug}/`:

```
~/.raycast-agents/
└── sources/
    └── craft-api/
        ├── config.json          # base URL, auth type, headers
        ├── guide.md             # API docs injected into Raycast AI
        └── .credential-cache.json
```

## Setup

1. Clone and open in Raycast dev mode:
   ```sh
   cd raycast-agents
   bun install
   bun run dev
   ```
2. In Raycast, open **Agents → Add Capability** preferences and add your Anthropic API key.
3. Run **Add Capability** and describe any REST API.
