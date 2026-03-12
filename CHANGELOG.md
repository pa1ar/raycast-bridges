# Changelog

## [Edit Guide action] - 2026-03-12

- "Edit Guide" / "Edit Skill File" action in Manage Capabilities opens guide.md or SKILL.md in the default editor
- Available for API Sources, MCP Servers, CLI Tools, and Skills
- Shows toast if the file doesn't exist yet

## [CLI connectors + call-capability verbosity] - 2026-03-12

- CLI tool connectors: wrap shell CLIs (gh, vercel, kubectl, etc.) so Raycast AI can execute commands and report results
- AI scaffolding for CLI tools: agent checks installation, researches docs, writes config and guide
- Manual add mode for CLI tools: form-based add with name, command, description
- CLI tools appear in search-capabilities, list-capabilities, get-capability-guide
- `call-capability` executes CLI commands with the subcommand and flags as the path field (30s timeout, 50KB output limit)
- Output header `[Source Name] METHOD path` added to all call-capability responses for better scannability
- Manage Capabilities: CLI Tools section with edit, edit with AI, enable/disable, remove actions
- Edit with AI supports CLI tools

## [MCP calls via call-capability] - 2026-03-11

- `call-capability` now connects to configured MCP servers over stdio and can invoke MCP tools/resources/prompts instead of rejecting MCP slugs
- Added MCP pseudo-path support: `GET /tools`, `POST /tools/<tool>/call`, `GET /resources`, `POST /resources/read`, `GET /prompts`, `POST /prompts/<prompt>/get`
- Updated guide/search/list tool copy so MCP capabilities advertise the supported calling pattern
- Added a `Start OAuth` / `Reconnect OAuth` action for OAuth-based MCP servers in Manage Capabilities, so the auth flow can be triggered from the Raycast action panel

## [MCP servers, AI scaffolding for skills, manual add, edit with AI] - 2026-03-10

- MCP server support: add, edit, and manage MCP server configurations alongside APIs and skills
- AI scaffolding for skills: describe what you want and the agent creates step-by-step instructions referencing your installed capabilities
- AI scaffolding for MCP servers: agent researches the server, writes config and documentation
- Manual add mode: form-based add for APIs and MCP servers without AI scaffolding
- Edit with AI: describe changes to any capability and the agent modifies its config/guide in place
- OAuth as auth type: APIs can now use OAuth 2.0 with PKCE (generic, not just Claude login)
- Reconnect action: clear cached credentials and re-authenticate
- MCP servers appear in search-capabilities, list-capabilities, and get-capability-guide
- call-capability rejects MCP slugs with a helpful message
- Extracted reusable components (SkillForm, EditSourceForm, EditSkillForm, OAuthCodeForm, ScaffoldProgress, etc.)

## [Search-first tool discovery] - 2026-03-10

- New search-capabilities tool: Raycast AI now searches for the right capability by keyword instead of listing everything
- Searches across names, descriptions, URLs, and full guide content
- When 5 or fewer capabilities are installed, returns all automatically (no search overhead)
- list-capabilities demoted to fallback for browsing all capabilities

## [Claude OAuth Login] - 2026-03-09

- Sign in with Claude account instead of requiring a separate Anthropic API key
- OAuth flow with PKCE: browser auth -> paste code -> tokens stored locally
- Auto-refresh expired tokens silently
- API key preference now optional (OAuth takes priority)
- Sign out action in Manage Capabilities
- Cleaner connection test message (no more confusing HTTP 404 display)

## [Initial Release] - 2026-03-05

- Add Capability: AI-powered API scaffolding wizard
- Manage Capabilities: edit, toggle, remove sources and skills
- AI tools: search-capabilities, list-capabilities, get-capability-guide, call-capability
