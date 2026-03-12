import { loadAllSources } from "../lib/sources";
import { loadAllSkills } from "../lib/skills";
import { loadAllMcps } from "../lib/mcps";
import { loadAllClis } from "../lib/clis";

export default async function listCapabilities(): Promise<{ text: string }> {
  const sources = loadAllSources();
  const skills = loadAllSkills();
  const mcps = loadAllMcps();
  const clis = loadAllClis();

  if (
    sources.length === 0 &&
    skills.length === 0 &&
    mcps.length === 0 &&
    clis.length === 0
  ) {
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

  if (clis.length > 0) {
    lines.push("[CLI Tools]");
    for (const c of clis) {
      lines.push(
        `- ${c.config.slug}: ${c.config.name} — ${c.config.description ?? c.config.command}`,
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
    "Use get-capability-guide with slug/name to load full docs. MCP servers use pseudo-paths like /tools. CLI tools use subcommand+flags as the path field.",
  );

  return { text: lines.join("\n") };
}
