import { loadAllSources } from "../lib/sources";
import { loadAllSkills } from "../lib/skills";
import { loadAllMcps } from "../lib/mcps";

export default async function listCapabilities(): Promise<{ text: string }> {
  const sources = loadAllSources();
  const skills = loadAllSkills();
  const mcps = loadAllMcps();

  if (sources.length === 0 && skills.length === 0 && mcps.length === 0) {
    return {
      text: "No capabilities installed. Use the 'Add Capability' command in Raycast to install one.",
    };
  }

  const lines: string[] = ["Available capabilities:", ""];

  if (sources.length > 0) {
    lines.push("[API Sources]");
    for (const s of sources) {
      lines.push(
        `- ${s.config.slug}: ${s.config.name} — ${s.config.description ?? s.config.baseUrl} [${s.isAuthenticated ? "authenticated" : "NOT authenticated"}]`,
      );
    }
    lines.push("");
  }

  if (mcps.length > 0) {
    lines.push("[MCP Servers]");
    for (const m of mcps) {
      lines.push(
        `- ${m.config.slug}: ${m.config.name} — ${m.config.description ?? m.config.command} [${m.isAuthenticated ? "ready" : "needs setup"}]`,
      );
    }
    lines.push("");
  }

  if (skills.length > 0) {
    lines.push("[Skills]");
    for (const sk of skills) {
      lines.push(`- ${sk.name}: ${sk.description}`);
    }
    lines.push("");
  }

  lines.push(
    "Use get-capability-guide with slug/name to load full docs or instructions. MCP servers are callable via call-capability using pseudo-paths like /tools and /tools/<tool>/call.",
  );

  return { text: lines.join("\n") };
}
