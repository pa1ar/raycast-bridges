import { Tool } from "@raycast/api";
import { callApi } from "../lib/api-call";
import { readCredential, readSourceConfig } from "../lib/sources";
import { listSkillNames } from "../lib/skills";
import { readMcpConfig } from "../lib/mcps";
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

  const mcpCfg = readMcpConfig(input.source);
  if (mcpCfg) {
    try {
      const result = await callMcp(mcpCfg, {
        path: input.path,
        method: input.method,
        params,
      });
      return { text: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        text: `Error calling MCP server ${mcpCfg.name}: ${message}`,
      };
    }
  }

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
      text: `${config.name} returned HTTP ${result.status}:\n${result.body}`,
    };
  }

  return { text: result.body };
}
