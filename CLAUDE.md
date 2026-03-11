# Bridges — Dev Notes

## Commands & Tools

- `npm run dev` — start dev mode (hot reload in Raycast)
- `npm run build` — production build
- `npm run lint` — lint + prettier check
- `npm run test` — run vitest

## Architecture

**Raycast AI tool flow (search-first):**

1. `search-capabilities` — keyword search across names, descriptions, guides. Returns matching capabilities. If ≤5 total, returns all without searching.
2. `list-capabilities` — fallback: lists everything. Used when search returns nothing or user wants to browse.
3. `get-capability-guide` — returns full guide.md for a source (call once, stays in history)
4. `call-capability` — calls REST APIs and MCP servers (MCP uses pseudo-paths like `/tools` and `/tools/<tool>/call`)

**State on disk:** `~/.bridges/sources/{slug}/`

- `config.json` — slug, name, baseUrl, authType, defaultHeaders, enabled
- `guide.md` — API docs for the AI (endpoints, workflow, examples)
- `.credential-cache.json` — stored token/key (never committed)

## Scaffolding

Uses `@anthropic-ai/claude-agent-sdk` `query()` with the system `claude` binary.
Key options: `permissionMode: bypassPermissions`, `allowDangerouslySkipPermissions: true`, tools: Write/Read/WebSearch/WebFetch/Bash.

The agent searches the web for real API docs, fetches OpenAPI specs, then writes config.json + guide.md.

**Auth:** OAuth token (via Claude login) or Anthropic API key (preferences). OAuth takes priority. Token passed as `CLAUDE_CODE_OAUTH_TOKEN`; API key as `ANTHROPIC_API_KEY`. OAuth tokens stored in Raycast LocalStorage, auto-refreshed on expiry.

**Env vars stripped from subprocess:** `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT` — required to allow nested claude invocation.

## Known Patterns

- `pathToClaudeCodeExecutable` must point to the system `claude` binary — `import.meta.url` is undefined in Raycast's esbuild bundle so `createRequire` doesn't work
- Raycast MCP config lives in encrypted SQLite — can't write to it programmatically; tools are registered via `package.json` `"tools"` array instead
- Guide must lead with workflow, not endpoint list — AI ignores generic docs but follows explicit step-by-step patterns
- `defaultHeaders` in config.json is injected into every request (e.g. `Accept: text/markdown` for Craft)
- MCP configs can be invoked from `call-capability` by spawning the configured command over stdio; remote MCPs can still work if wrapped by a local bridge like `mcp-remote`

## Before Every Commit

1. Update `CHANGELOG.md` if the change is user-facing. Format: `## [Title] - YYYY-MM-DD` with `-` bullet points, newest first.
2. `npm run build && npm run lint && npm run test` must all pass.

## Releases & Updates

- **Versioning:** handled by Raycast on publish (`npm run publish`). Don't manually bump versions.
- **Screenshots:** store in `media/` folder, 2000x1250px PNG (16:10), 3-6 images. Required before first Store submission.
- **Publishing:** `npm run publish` opens a PR to `raycast/extensions`. Raycast team reviews and merges.
