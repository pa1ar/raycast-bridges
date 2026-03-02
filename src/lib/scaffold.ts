import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// use the system-installed claude binary (avoids import.meta.url issues in bundled env)
function findClaude(): string {
  const candidates = [
    join(homedir(), ".local/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  try { return execSync("which claude", { encoding: "utf-8" }).trim(); } catch { /* ignore */ }
  throw new Error("claude CLI not found. Install Claude Code: https://claude.ai/download");
}
import { sourceConfigPath, sourceDir, sourceGuidePath } from "./paths";
import type { SourceConfig } from "./types";

const SCAFFOLD_LOG = join(homedir(), ".raycast-agents", "scaffold.log");

function appendLog(msg: string) {
  try {
    mkdirSync(join(homedir(), ".raycast-agents"), { recursive: true });
    writeFileSync(SCAFFOLD_LOG, `${new Date().toISOString()} ${msg}\n`, { flag: "a" });
  } catch { /* ignore */ }
}

const SCAFFOLD_PROMPT = (description: string) => `
You are scaffolding a new API capability for a local Raycast AI extension called Raycast Agents.

User description: ${description}

Your task: create exactly two files in the current working directory.

## Step 1 — Research
If a URL was provided, search the web for the official API documentation for that service.
Look for: authentication method, real endpoint paths, request/response formats.
Do NOT invent endpoints — only document what you confirm from the docs or spec.
If you find an OpenAPI/Swagger spec URL, fetch it.

## Step 2 — Write config.json
JSON file with this exact schema:
{
  "slug": "<kebab-case-id>",
  "name": "<Human Readable Name>",
  "description": "<one sentence — shown in capability list>",
  "baseUrl": "<exact base URL — use what the user provided, do NOT change the domain>",
  "authType": "<bearer|api-key|basic|none>",
  "apiKeyHeader": "<header name, only if authType is api-key>",
  "defaultHeaders": { "<key>": "<value>" },
  "enabled": true,
  "createdAt": ${Date.now()},
  "updatedAt": ${Date.now()}
}

authType:
- "bearer" → Authorization: Bearer <token>
- "api-key" → custom header (set apiKeyHeader)
- "basic" → HTTP Basic Auth
- "none" → no auth

## Step 3 — Write guide.md
The guide is loaded ONCE by an AI assistant before making API calls. It must be complete and accurate.

Structure:
# <Name> API

## Authentication
<exact header format>

## Endpoints
### <Name>
- <METHOD> \`<path>\`
- <description>
- Params: <list>
- Response: <shape>

[one section per endpoint — only document confirmed endpoints]

## Typical Workflow
<numbered steps for the most common task, using the exact endpoint paths above>

## Example
<real request + expected response shape>

Rules for the guide:
- NEVER document /resource/{id} URL path params unless the spec explicitly shows it — many APIs use query params (?id=) instead
- If an endpoint is unconfirmed, mark it [unconfirmed]
- Include a "Typical Workflow" section showing the exact call sequence
- Set defaultHeaders in config.json if the API has a preferred response format (e.g. Accept: text/markdown)

Write both files now. Do not ask questions.
`.trim();

export interface ScaffoldResult {
  success: boolean;
  config?: SourceConfig;
  error?: string;
}

export async function scaffoldSource(
  description: string,
  apiKey: string,
  onOutput: (line: string) => void,
): Promise<ScaffoldResult> {
  appendLog(`starting scaffold: ${description.slice(0, 100)}`);

  const tempSlug = `_scaffold_${Date.now()}`;
  const workDir = sourceDir(tempSlug);
  mkdirSync(workDir, { recursive: true });

  onOutput("Starting agent...");

  try {
    const messages = query({
      prompt: SCAFFOLD_PROMPT(description),
      options: {
        cwd: workDir,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: apiKey,
          // strip vars that block nested claude sessions
          CLAUDECODE: undefined,
          CLAUDE_CODE_SESSION_ID: undefined,
          CLAUDE_CODE_ENTRYPOINT: undefined,
        },
        pathToClaudeCodeExecutable: findClaude(),
        allowedTools: ["Write", "Read", "WebSearch", "WebFetch", "Bash"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 20,
      },
    });

    for await (const msg of messages) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text.trim()) {
            const lines = block.text.trim().split("\n").filter(Boolean);
            lines.forEach(onOutput);
            appendLog(`agent: ${block.text.slice(0, 100)}`);
          } else if (block.type === "tool_use") {
            onOutput(`[${block.name}] ${JSON.stringify(block.input).slice(0, 80)}`);
          }
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendLog(`agent error: ${msg}`);
    onOutput(`Error: ${msg}`);
    // clean up temp dir
    try { require("child_process").execSync(`rm -rf "${workDir}"`); } catch { /* ignore */ }
    return { success: false, error: msg };
  }

  // read what the agent wrote
  if (!existsSync(sourceConfigPath(tempSlug))) {
    try { require("child_process").execSync(`rm -rf "${workDir}"`); } catch { /* ignore */ }
    const err = "Agent did not produce config.json";
    appendLog(err);
    return { success: false, error: err };
  }

  let config: SourceConfig;
  try {
    config = JSON.parse(readFileSync(sourceConfigPath(tempSlug), "utf-8"));
  } catch (e) {
    try { require("child_process").execSync(`rm -rf "${workDir}"`); } catch { /* ignore */ }
    return { success: false, error: `Invalid config.json: ${e}` };
  }

  const now = Date.now();
  config.createdAt = config.createdAt || now;
  config.updatedAt = now;

  const finalDir = sourceDir(config.slug);
  try {
    renameSync(workDir, finalDir);
  } catch {
    // dir exists — overwrite config + guide, keep credentials
    writeFileSync(sourceConfigPath(config.slug), JSON.stringify(config, null, 2), "utf-8");
    if (existsSync(sourceGuidePath(tempSlug))) {
      writeFileSync(sourceGuidePath(config.slug), readFileSync(sourceGuidePath(tempSlug)));
    }
    try { require("child_process").execSync(`rm -rf "${workDir}"`); } catch { /* ignore */ }
  }

  onOutput(`Done: ${config.name}`);
  appendLog(`scaffold complete: ${config.slug}`);
  return { success: true, config };
}
