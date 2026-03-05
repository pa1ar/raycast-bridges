import { readGuide, readSourceConfig } from "../lib/sources";
import { readSkillMd } from "../lib/skills";

interface Input {
  /** slug of an API source or name of a skill */
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

  // try skill
  const skillContent = readSkillMd(input.source);
  if (skillContent) {
    return { text: skillContent };
  }

  return {
    text: `Capability '${input.source}' not found. Call list-capabilities to see available options.`,
  };
}
