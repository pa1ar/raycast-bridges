import { query } from "@anthropic-ai/claude-agent-sdk";
import { readMcpConfig, readMcpGuide } from "./mcps";
import { mcpDir, skillDir, sourceDir } from "./paths";
import { findClaude, appendLog } from "./scaffold-shared";
import { readSkillMd } from "./skills";
import { readGuide, readSourceConfig } from "./sources";

const EDIT_PROMPT = (
  type: string,
  existingConfig: string,
  existingGuide: string,
  editDescription: string,
) =>
  `
You are editing an existing ${type} capability for a Raycast AI extension called Bridges.

## Current config.json
\`\`\`json
${existingConfig}
\`\`\`

## Current guide/instructions
\`\`\`markdown
${existingGuide}
\`\`\`

## User's requested changes
${editDescription}

## Your task
Modify the existing files in the current working directory based on the user's request.
- Read the existing files first
- Make the requested changes
- Write the updated files back
- For API sources: update config.json and/or guide.md
- For MCP servers: update config.json and/or guide.md
- For skills: update SKILL.md
- You can search the web for API documentation if needed
- Preserve existing content that wasn't asked to change
- Update the "updatedAt" timestamp in config.json to ${Date.now()}

Apply the changes now. Do not ask questions.
`.trim();

export interface ScaffoldEditResult {
  success: boolean;
  error?: string;
}

export async function scaffoldEdit(
  slug: string,
  type: "api" | "mcp" | "skill",
  editDescription: string,
  auth: { apiKey?: string; oauthToken?: string },
  onOutput: (line: string) => void,
): Promise<ScaffoldEditResult> {
  appendLog(
    `starting edit: ${slug} (${type}): ${editDescription.slice(0, 80)}`,
  );

  let workDirPath: string;
  let existingConfig = "";
  let existingGuide = "";

  if (type === "api") {
    workDirPath = sourceDir(slug);
    const config = readSourceConfig(slug);
    existingConfig = config ? JSON.stringify(config, null, 2) : "{}";
    existingGuide = readGuide(slug);
  } else if (type === "mcp") {
    workDirPath = mcpDir(slug);
    const config = readMcpConfig(slug);
    existingConfig = config ? JSON.stringify(config, null, 2) : "{}";
    existingGuide = readMcpGuide(slug);
  } else {
    workDirPath = skillDir(slug);
    existingGuide = readSkillMd(slug);
  }

  const claudePath = findClaude();
  if (!claudePath) {
    const msg =
      "Claude CLI not found. Install it from https://claude.ai/download";
    onOutput(msg);
    return { success: false, error: msg };
  }

  onOutput("Starting agent...");

  try {
    const messages = query({
      prompt: EDIT_PROMPT(type, existingConfig, existingGuide, editDescription),
      options: {
        cwd: workDirPath,
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
        maxTurns: 15,
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
    appendLog(`edit agent error: ${msg}`);
    onOutput(`Error: ${msg}`);
    return { success: false, error: msg };
  }

  onOutput("Done");
  appendLog(`edit complete: ${slug}`);
  return { success: true };
}
