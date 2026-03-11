import { readGuide, readSourceConfig } from "../lib/sources";
import { readSkillMd } from "../lib/skills";
import { readMcpConfig, readMcpGuide } from "../lib/mcps";

interface Input {
  /** slug of an API source, MCP server, or name of a skill */
  source: string;
}

export default async function getCapabilityGuide(
  input: Input,
): Promise<{ text: string }> {
  // try API source first
  const config = readSourceConfig(input.source);
  if (config) {
    const guide = readGuide(input.source);
    if (!guide) {
      return {
        text: [
          `# ${config.name}`,
          `Base URL: ${config.baseUrl}`,
          `Auth: ${config.authType}`,
          "",
          "No guide available for this capability. Call call-capability with paths based on the base URL.",
        ].join("\n"),
      };
    }

    return {
      text: [
        `# Guide: ${config.name}`,
        `Base URL: ${config.baseUrl}`,
        `Auth: ${config.authType}${config.apiKeyHeader ? ` (header: ${config.apiKeyHeader})` : ""}`,
        "",
        guide,
        "",
        "You now have the full API documentation. Use call-capability to make requests.",
      ].join("\n"),
    };
  }

  // try MCP server
  const mcpCfg = readMcpConfig(input.source);
  if (mcpCfg) {
    const guide = readMcpGuide(input.source);
    const meta = [
      `# Guide: ${mcpCfg.name} (MCP Server)`,
      `Command: \`${mcpCfg.command}${mcpCfg.args ? " " + mcpCfg.args.join(" ") : ""}\``,
    ];
    if (mcpCfg.env) {
      meta.push(`Env vars: ${Object.keys(mcpCfg.env).join(", ")}`);
    }
    meta.push("");

    if (!guide) {
      return {
        text: [
          ...meta,
          "No guide available for this MCP server.",
          "",
          "Call it via call-capability using MCP pseudo-paths.",
          "Examples: GET /tools, POST /tools/<tool-name>/call, GET /resources, POST /resources/read.",
        ].join("\n"),
      };
    }

    return {
      text: [
        ...meta,
        guide,
        "",
        "Call it via call-capability using MCP pseudo-paths.",
        "Examples: GET /tools, POST /tools/<tool-name>/call, GET /resources, POST /resources/read.",
      ].join("\n"),
    };
  }

  // try skill
  const skillContent = readSkillMd(input.source);
  if (skillContent) {
    return { text: skillContent };
  }

  return {
    text: `Capability '${input.source}' not found. Call list-capabilities to see available options.`,
  };
}
