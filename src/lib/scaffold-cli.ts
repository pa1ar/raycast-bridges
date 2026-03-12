import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import { cliConfigPath, cliDir, cliGuidePath, CLIS_DIR } from "./paths";
import { findClaude, appendLog, buildEnhancedPath } from "./scaffold-shared";
import type { CliConfig } from "./types";

const SCAFFOLD_CLI_PROMPT = (description: string) =>
  `
You are scaffolding a new CLI tool connector for a Raycast AI extension called Bridges.

User description: ${description}

Your task: create exactly two files in the current working directory.

## Step 1 — Research
Search the web for the CLI tool the user described. Look for:
- Official documentation
- Available subcommands and flags
- Authentication methods

## Step 2 — Check installation
Run \`which <command>\` to see if the CLI is installed.
If not installed:
- Check \`which brew\` — if available, run \`brew install <package>\`
- Verify with \`which <command>\` again
If still not found, note it in the guide and proceed.

## Step 3 — Verify
Run \`<command> --help\` or \`<command> --version\` to confirm the CLI works.

## Step 4 — Write config.json
JSON file with this exact schema:
{
  "slug": "<kebab-case-id>",
  "name": "<Human Readable Name>",
  "description": "<one sentence — shown in capability list>",
  "command": "<the CLI binary name, e.g. gh>",
  "authType": "none",
  "enabled": true,
  "createdAt": ${Date.now()},
  "updatedAt": ${Date.now()}
}

Notes:
- command is just the binary name (e.g. "gh", "vercel", "kubectl")
- authType is usually "none" since CLIs handle auth themselves

## Step 5 — Write guide.md
Structure:
# <CLI Name>

## Authentication
<how to auth — e.g. "gh auth login">

## Commands
### <subcommand>
- Description
- Flags: --flag (description)
- Example: full command line

[one section per important subcommand]

## Typical Workflow
1. step one
2. step two

Rules:
- Document the most useful subcommands from official docs and --help output
- Include real examples with flags
- Note streaming/long-running commands are not supported (30s timeout)

Write both files now. Do not ask questions.
`.trim();

export interface ScaffoldCliResult {
  success: boolean;
  config?: CliConfig;
  error?: string;
}

export async function scaffoldCli(
  description: string,
  auth: { apiKey?: string; oauthToken?: string },
  onOutput: (line: string) => void,
): Promise<ScaffoldCliResult> {
  appendLog(`starting cli scaffold: ${description.slice(0, 100)}`);

  const tempSlug = `_scaffold_${Date.now()}`;
  const workDir = cliDir(tempSlug);
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
      prompt: SCAFFOLD_CLI_PROMPT(description),
      options: {
        cwd: workDir,
        env: {
          ...process.env,
          PATH: buildEnhancedPath(),
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
  if (!existsSync(cliConfigPath(tempSlug))) {
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: "Agent did not produce config.json" };
  }

  let config: CliConfig;
  try {
    config = JSON.parse(readFileSync(cliConfigPath(tempSlug), "utf-8"));
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

  const finalDir = cliDir(config.slug);
  try {
    mkdirSync(CLIS_DIR, { recursive: true });
    renameSync(workDir, finalDir);
  } catch {
    // dir exists — overwrite
    writeFileSync(
      cliConfigPath(config.slug),
      JSON.stringify(config, null, 2),
      "utf-8",
    );
    if (existsSync(cliGuidePath(tempSlug))) {
      writeFileSync(
        cliGuidePath(config.slug),
        readFileSync(cliGuidePath(tempSlug)),
      );
    }
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  onOutput(`Done: ${config.name}`);
  appendLog(`cli scaffold complete: ${config.slug}`);
  return { success: true, config };
}
