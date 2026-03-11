# Bridges: Skills AI Scaffold, MCP Support, Manual Add, Edit with AI

All tasks completed.

```
[x] P0: extract shared components
notes: SkillForm, EditSourceForm, EditSkillForm, OAuthCodeForm, ScaffoldProgress, ManualApiForm, ManualMcpForm, EditMcpForm, EditWithAiForm

[x] T1: add oauth auth type
notes: OAuthConfig interface, generic-oauth.ts with PKCE flow, "oauth" added to AuthType

[x] T2: MCP storage layer
notes: McpConfig/LoadedMcp types, paths.ts mcps functions, mcps.ts CRUD

[x] T3: MCPs in search/list/get-guide tools
notes: all 4 tools updated, call-capability rejects MCPs with message

[x] T4: manual API add form
notes: ManualApiForm with OAuth config fields, method selection step in add-capability

[x] T5: manual MCP add form
notes: ManualMcpForm with command/args/env fields

[x] T6: AI skill scaffolding
notes: scaffold-skill.ts, agent sees existing capabilities summary

[x] T7: AI MCP scaffolding
notes: scaffold-mcp.ts, agent researches server and writes config+guide

[x] T8: edit-with-AI action
notes: scaffold-edit.ts, EditWithAiForm, works for APIs/MCPs/skills

[x] T9: reconnect action
notes: deleteCredential in sources.ts, deleteMcpCredential in mcps.ts, reconnect actions in manage-capabilities

[x] T10: MCP management UI
notes: EditMcpForm, MCP Servers section in manage-capabilities with all actions
```
