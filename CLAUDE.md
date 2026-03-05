# Raycast Agents — Dev Notes

## Commands & Tools

- `npm run dev` — start dev mode (hot reload in Raycast)
- `npm run build` — production build
- `npm run lint` — lint + prettier check
- `npm run test` — run vitest

## Architecture

**3-step Raycast AI tool flow:**
1. `list-capabilities` — returns slug + one-liner per source
2. `get-capability-guide` — returns full guide.md for a source (call once, stays in history)
3. `call-capability` — makes the actual HTTP request with injected auth

**State on disk:** `~/.raycast-agents/sources/{slug}/`
- `config.json` — slug, name, baseUrl, authType, defaultHeaders, enabled
- `guide.md` — API docs for the AI (endpoints, workflow, examples)
- `.credential-cache.json` — stored token/key (never committed)

## Scaffolding

Uses `@anthropic-ai/claude-agent-sdk` `query()` with the system `claude` binary.
Key options: `permissionMode: bypassPermissions`, `allowDangerouslySkipPermissions: true`, tools: Write/Read/WebSearch/WebFetch/Bash.

The agent searches the web for real API docs, fetches OpenAPI specs, then writes config.json + guide.md.

**Auth:** Anthropic API key stored in Raycast extension preferences (password field). Passed via `env.ANTHROPIC_API_KEY` to the agent subprocess.

**Env vars stripped from subprocess:** `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT` — required to allow nested claude invocation.

## Known Patterns

- `pathToClaudeCodeExecutable` must point to the system `claude` binary — `import.meta.url` is undefined in Raycast's esbuild bundle so `createRequire` doesn't work
- Raycast MCP config lives in encrypted SQLite — can't write to it programmatically; tools are registered via `package.json` `"tools"` array instead
- Guide must lead with workflow, not endpoint list — AI ignores generic docs but follows explicit step-by-step patterns
- `defaultHeaders` in config.json is injected into every request (e.g. `Accept: text/markdown` for Craft)
