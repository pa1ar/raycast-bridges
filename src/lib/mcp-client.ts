import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "fs";
import { delimiter, join } from "path";
import { homedir } from "os";
import type { McpConfig } from "./types";

interface McpRequest {
  path: string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpCallOptions {
  timeoutMs?: number;
}

const MCP_REQUEST_TIMEOUT_MS = 30_000;
const COMMON_BIN_DIRS = [
  join(homedir(), ".nvm/versions/node/v22.18.0/bin"),
  join(homedir(), ".nvm/versions/node/v22/bin"),
  join(homedir(), ".bun/bin"),
  join(homedir(), ".pyenv/shims"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

export async function callMcp(
  config: McpConfig,
  request: McpRequest,
  options: McpCallOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? MCP_REQUEST_TIMEOUT_MS;
  const env = buildChildEnv(config.env);
  const command = resolveCommand(config.command, env.PATH);
  const stderrChunks: string[] = [];
  const transport = new StdioClientTransport({
    command,
    args: config.args,
    env,
    stderr: "pipe",
  });

  const stderr = transport.stderr;
  if (stderr) {
    stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  const client = new Client(
    {
      name: "bridges",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  try {
    await client.connect(transport, { timeout: timeoutMs });
    const result = await routeMcpRequest(client, request, timeoutMs);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderrText = stderrChunks.join("").trim();
    throw new Error(
      stderrText ? `${message}\n\nstderr:\n${stderrText}` : message,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

function buildChildEnv(
  extraEnv?: Record<string, string>,
): Record<string, string> {
  const pathEntries = new Set(
    [process.env.PATH, ...COMMON_BIN_DIRS]
      .filter(Boolean)
      .flatMap((value) => String(value).split(delimiter))
      .filter(Boolean),
  );

  return {
    ...process.env,
    ...extraEnv,
    PATH: Array.from(pathEntries).join(delimiter),
  };
}

function resolveCommand(command: string, pathValue?: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("MCP command is empty");
  }

  if (trimmed.includes("/")) {
    return trimmed;
  }

  const candidates = (pathValue || "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, trimmed));

  const match = candidates.find((candidate) => existsSync(candidate));
  if (match) {
    return match;
  }

  return trimmed;
}

async function routeMcpRequest(
  client: Client,
  request: McpRequest,
  timeoutMs: number,
): Promise<unknown> {
  const path = normalizePath(request.path);
  const params = request.params;
  const options = { timeout: timeoutMs };

  if (path === "/ping") {
    return client.ping(options);
  }

  if (path === "/tools" || path === "/tools/list") {
    return client.listTools(asCursorParams(params), options);
  }

  const toolMatch = path.match(/^\/tools\/([^/]+)\/call$/);
  if (toolMatch) {
    return client.callTool(
      {
        name: decodeURIComponent(toolMatch[1]),
        arguments: params,
      },
      undefined,
      options,
    );
  }

  if (path === "/resources" || path === "/resources/list") {
    return client.listResources(asCursorParams(params), options);
  }

  if (
    path === "/resource-templates" ||
    path === "/resources/templates" ||
    path === "/resources/templates/list"
  ) {
    return client.listResourceTemplates(asCursorParams(params), options);
  }

  if (path === "/resources/read") {
    return client.readResource(requireObject(params, "readResource"), options);
  }

  if (path === "/prompts" || path === "/prompts/list") {
    return client.listPrompts(asCursorParams(params), options);
  }

  const promptMatch = path.match(/^\/prompts\/([^/]+)\/get$/);
  if (promptMatch) {
    return client.getPrompt(
      {
        name: decodeURIComponent(promptMatch[1]),
        arguments: asStringRecord(params),
      },
      options,
    );
  }

  throw new Error(
    [
      `Unsupported MCP path: ${request.path}`,
      "Supported paths:",
      "- GET /ping",
      "- GET /tools or /tools/list",
      "- POST /tools/<tool-name>/call",
      "- GET /resources or /resources/list",
      "- GET /resource-templates or /resources/templates",
      "- POST /resources/read",
      "- GET /prompts or /prompts/list",
      "- POST /prompts/<prompt-name>/get",
    ].join("\n"),
  );
}

function normalizePath(path: string): string {
  const trimmed = path.trim() || "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function asCursorParams(
  params?: Record<string, unknown>,
): { cursor?: string } | undefined {
  if (!params) return undefined;
  const cursor = params.cursor;
  if (typeof cursor !== "string" || !cursor) return undefined;
  return { cursor };
}

function requireObject(
  params: Record<string, unknown> | undefined,
  operation: string,
): Record<string, unknown> {
  if (!params) {
    throw new Error(`${operation} requires JSON params`);
  }
  return params;
}

function asStringRecord(
  params?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  return out;
}
