import { Tool } from "@raycast/api";
import { callApi } from "../lib/api-call";
import { readCredential, readSourceConfig } from "../lib/sources";
import { listSkillNames } from "../lib/skills";
import { readMcpConfig, readMcpCredential } from "../lib/mcps";
import { readCliConfig } from "../lib/clis";
import { execCli } from "../lib/cli-exec";
import { callMcp } from "../lib/mcp-client";

interface Input {
  /** slug of the capability to call, e.g. "craft-api" */
  source: string;
  /** API path, e.g. "/documents/search" */
  path: string;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Query params (GET) or request body (POST/PUT/PATCH), as a JSON string */
  params?: string;
}

function header(name: string, method: string, path: string): string {
  return `[${name}] ${method} ${path}\n\n`;
}

export default async function callCapability(
  input: Input,
): Promise<Tool.Output> {
  let params: Record<string, unknown> | undefined;
  if (input.params) {
    try {
      params = JSON.parse(input.params);
    } catch {
      return { text: `Invalid params JSON: ${input.params}` };
    }
  }

  if (listSkillNames().includes(input.source)) {
    return {
      text: `'${input.source}' is a skill, not an API source. Read its instructions via get-capability-guide and follow them directly.`,
    };
  }

  // CLI tool
  const cliCfg = readCliConfig(input.source);
  if (cliCfg) {
    if (!cliCfg.enabled) {
      return { text: `Capability '${input.source}' is disabled.` };
    }
    const result = execCli(cliCfg.command, input.path);
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    if (result.exitCode !== 0) {
      return {
        text:
          header(cliCfg.name, input.method, input.path) +
          `Exit code ${result.exitCode}:\n${output}`,
      };
    }
    return { text: header(cliCfg.name, input.method, input.path) + output };
  }

  // MCP server
  const mcpCfg = readMcpConfig(input.source);
  if (mcpCfg) {
    try {
      const result = await callMcp(
        mcpCfg,
        {
          path: input.path,
          method: input.method,
          params,
        },
        {
          credential: readMcpCredential(mcpCfg.slug) ?? undefined,
        },
      );
      return { text: header(mcpCfg.name, input.method, input.path) + result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        text: `Error calling MCP server ${mcpCfg.name}: ${message}`,
      };
    }
  }

  // API source
  const config = readSourceConfig(input.source);
  if (!config) {
    return {
      text: `Capability '${input.source}' not found. Use list-capabilities to see installed capabilities.`,
    };
  }
  if (!config.enabled) {
    return { text: `Capability '${input.source}' is disabled.` };
  }

  const credential = readCredential(input.source) ?? "";
  if (config.authType !== "none" && !credential) {
    return {
      text: `Capability '${input.source}' is not authenticated. Open Raycast and run 'Manage Capabilities' to set credentials.`,
    };
  }

  const result = await callApi(config, credential, {
    path: input.path,
    method: input.method,
    params,
  });

  if (result.error) {
    return { text: `Error calling ${config.name}: ${result.error}` };
  }

  if (!result.ok) {
    return {
      text:
        header(config.name, input.method, input.path) +
        `HTTP ${result.status}:\n${result.body}`,
    };
  }

  return { text: header(config.name, input.method, input.path) + result.body };
}
