import { loadAllSources } from "../lib/sources";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Input {}

export default async function listCapabilities(_: Input): Promise<{ text: string }> {
  const sources = loadAllSources();

  if (sources.length === 0) {
    return { text: "No capabilities installed. Use the 'Add Capability' command in Raycast to install one." };
  }

  const lines = [
    "Available capabilities (use get-capability-guide to load full docs before calling):",
    "",
    ...sources.map((s) =>
      `- **${s.config.slug}**: ${s.config.name} — ${s.config.description ?? s.config.baseUrl} [${s.isAuthenticated ? "authenticated" : "NOT authenticated"}]`
    ),
    "",
    "Before using any capability, call get-capability-guide with the slug to get endpoint documentation.",
  ];

  return { text: lines.join("\n") };
}
