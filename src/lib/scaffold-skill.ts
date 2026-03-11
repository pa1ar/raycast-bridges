import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { loadAllMcps } from "./mcps";
import { skillDir, skillMdPath, SKILLS_DIR } from "./paths";
import { findClaude, appendLog } from "./scaffold-shared";
import { loadAllSkills } from "./skills";
import { loadAllSources } from "./sources";

const SCAFFOLD_SKILL_PROMPT = (
  description: string,
  capabilitiesSummary: string,
) =>
  `
You are creating a new AI skill for a Raycast extension called Bridges.
A skill is a set of instructions that tells an AI assistant how to perform a multi-step task.

User description: ${description}

## Existing capabilities the skill can reference:
${capabilitiesSummary || "No capabilities installed yet."}

## Your task
Create a file called SKILL.md in the current working directory.

## SKILL.md format
\`\`\`markdown
---
name: <kebab-case-name>
description: "<one sentence describing what this skill does>"
---

# <name>

<Step-by-step instructions for the AI to follow>
\`\`\`

## Rules
- Reference existing capabilities by their slug when the skill needs to call APIs or use MCP servers
- Be specific about the order of operations
- Include error handling instructions (what to do if a step fails)
- If the skill needs data from a capability, tell the AI to call get-capability-guide first
- Search the web for best practices if the task involves a well-known workflow

Write the SKILL.md file now. Do not ask questions.
`.trim();

function buildCapabilitiesSummary(): string {
  const sources = loadAllSources();
  const mcps = loadAllMcps();
  const skills = loadAllSkills();

  const lines: string[] = [];
  for (const s of sources) {
    lines.push(
      `- [API] ${s.config.slug}: ${s.config.name} — ${s.config.description ?? s.config.baseUrl}`,
    );
  }
  for (const m of mcps) {
    lines.push(
      `- [MCP] ${m.config.slug}: ${m.config.name} — ${m.config.description ?? m.config.command}`,
    );
  }
  for (const sk of skills) {
    lines.push(`- [Skill] ${sk.name}: ${sk.description}`);
  }
  return lines.join("\n");
}

export interface ScaffoldSkillResult {
  success: boolean;
  name?: string;
  error?: string;
}

export async function scaffoldSkill(
  description: string,
  auth: { apiKey?: string; oauthToken?: string },
  onOutput: (line: string) => void,
): Promise<ScaffoldSkillResult> {
  appendLog(`starting skill scaffold: ${description.slice(0, 100)}`);

  const tempName = `_scaffold_${Date.now()}`;
  const workDir = skillDir(tempName);
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
  const summary = buildCapabilitiesSummary();

  try {
    const messages = query({
      prompt: SCAFFOLD_SKILL_PROMPT(description, summary),
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
    appendLog(`agent error: ${msg}`);
    onOutput(`Error: ${msg}`);
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: msg };
  }

  // read what the agent wrote
  const skillPath = join(workDir, "SKILL.md");
  if (!existsSync(skillPath)) {
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
    return { success: false, error: "Agent did not produce SKILL.md" };
  }

  const content = readFileSync(skillPath, "utf-8");

  // extract name from frontmatter
  const nameMatch = content.match(/^---\n[\s\S]*?name:\s*(.+)\n[\s\S]*?---/);
  const name = nameMatch?.[1]?.trim() ?? tempName;

  // move to final location
  const finalDir = skillDir(name);
  try {
    if (existsSync(finalDir)) rmSync(finalDir, { recursive: true });
    mkdirSync(join(SKILLS_DIR), { recursive: true });
    renameSync(workDir, finalDir);
  } catch {
    // fallback: write directly
    mkdirSync(finalDir, { recursive: true });
    writeFileSync(skillMdPath(name), content, "utf-8");
    try {
      rmSync(workDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  onOutput(`Done: ${name}`);
  appendLog(`skill scaffold complete: ${name}`);
  return { success: true, name };
}
