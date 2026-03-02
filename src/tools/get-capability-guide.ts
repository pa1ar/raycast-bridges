import { readGuide, readSourceConfig } from "../lib/sources";

interface Input {
  /** slug of the capability, e.g. "craft-api" */
  source: string;
}

export default async function getCapabilityGuide(input: Input): Promise<{ text: string }> {
  const config = readSourceConfig(input.source);
  if (!config) {
    return { text: `Capability '${input.source}' not found. Call list-capabilities to see available options.` };
  }

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
