import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import { mcpConfigPath, mcpDir, mcpGuidePath, MCPS_DIR } from "./paths";
import { findClaude, appendLog } from "./scaffold-shared";
import type { McpConfig } from "./types";

const SCAFFOLD_MCP_PROMPT = (description: string) =>
  `
You are scaffolding a new MCP (Model Context Protocol) server configuration for a Raycast AI extension called Bridges.

User description: ${description}

Your task: create exactly two files in the current working directory.

## Step 1 — Research
Search the web for the MCP server the user described. Look for:
- npm package name or GitHub repository
- Installation command (npx, uvx, etc.)
- Required environment variables
- Available tools/resources the server provides

## Step 2 — Write config.json
JSON file with this exact schema:
{
  "slug": "<kebab-case-id>",
  "name": "<Human Readable Name>",
  "description": "<one sentence — shown in capability list>",
  "command": "<command to start the server, e.g. npx>",
  "args": ["<arg1>", "<arg2>"],
  "env": { "KEY": "VALUE_PLACEHOLDER" },
  "authType": "none",
  "enabled": true,
  "createdAt": ${Date.now()},
  "updatedAt": ${Date.now()}
}

Notes:
- command is usually "npx" or "uvx" or a direct binary path
- args includes the package name and any flags (e.g. ["@modelcontextprotocol/server-github", "--stdio"])
- env contains required environment variables with placeholder values (user will fill in real values)
- authType is usually "none" since MCP servers handle auth via env vars

## Step 3 — Write guide.md
The guide documents what the MCP server does and what tools it provides.

Structure:
# <Name> MCP Server

## Setup
<installation and env var requirements>

## Tools
### <tool-name>
- <description>
- Input: <params>
- Output: <what it returns>

[one section per tool]

## Typical Workflow
<numbered steps for common tasks>

Rules:
- Only document confirmed tools from official docs
- If a tool is unconfirmed, mark it [unconfirmed]
- Include env var setup instructions

Write both files now. Do not ask questions.
`.trim();

export interface ScaffoldMcpResult {
  success: boolean;
  config?: McpConfig;
  error?: string;
}

export async function scaffoldMcp(
  description: string,
  auth: { apiKey?: string; oauthToken?: string },
  onOutput: (line: string) => void,
): Promise<ScaffoldMcpResult> {
  appendLog(`starting mcp scaffold: ${description.slice(0, 100)}`);

  const tempSlug = `_scaffold_${Date.now()}`;
  const workDir = mcpDir(tempSlug);
  mkdirSync(workDir, { recursive: true });

  const claudePath = findClaude();
  if (!claudePath) {
    const msg =
      "Claude CLI not found. Install it from https://claude.ai/download";
    onOutput(msg);
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: msg };
  }

  onOutput("Starting agent...");

  try {
    const messages = query({
      prompt: SCAFFOLD_MCP_PROMPT(description),
      options: {
        cwd: workDir,
        env: {
          ...process.env,
          ...(auth.oauthToken
            ? { CLAUDE_CODE_OAUTH_TOKEN: auth.oauthToken }
            : { ANTHROPIC_API_KEY: auth.apiKey }),
          CLAUDECODE: undefined,
          CLAUDE_CODE_SESSION_ID: undefined,
          CLAUDE_CODE_ENTRYPOINT: undefined,
        },
        pathToClaudeCodeExecutable: claudePath,
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
            block.text.trim().split("\n").filter(Boolean).forEach(onOutput);
            appendLog(`agent: ${block.text.slice(0, 100)}`);
          } else if (block.type === "tool_use") {
            onOutput(
              `[${block.name}] ${JSON.stringify(block.input).slice(0, 80)}`,
            );
          }
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendLog(`agent error: ${msg}`);
    onOutput(`Error: ${msg}`);
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: msg };
  }

  // read config
  if (!existsSync(mcpConfigPath(tempSlug))) {
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: "Agent did not produce config.json" };
  }

  let config: McpConfig;
  try {
    config = JSON.parse(readFileSync(mcpConfigPath(tempSlug), "utf-8"));
  } catch (e) {
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: `Invalid config.json: ${e}` };
  }

  const now = Date.now();
  config.createdAt = config.createdAt || now;
  config.updatedAt = now;

  const finalDir = mcpDir(config.slug);
  try {
    mkdirSync(MCPS_DIR, { recursive: true });
    renameSync(workDir, finalDir);
  } catch {
    // dir exists — overwrite
    writeFileSync(
      mcpConfigPath(config.slug),
      JSON.stringify(config, null, 2),
      "utf-8",
    );
    if (existsSync(mcpGuidePath(tempSlug))) {
      writeFileSync(
        mcpGuidePath(config.slug),
        readFileSync(mcpGuidePath(tempSlug)),
      );
    }
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  onOutput(`Done: ${config.name}`);
  appendLog(`mcp scaffold complete: ${config.slug}`);
  return { success: true, config };
}
