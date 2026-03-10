# Changelog

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
