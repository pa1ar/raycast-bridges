import { loadAllSources } from "../lib/sources";
import { loadAllSkills } from "../lib/skills";

export default async function listCapabilities(): Promise<{ text: string }> {
  const sources = loadAllSources();
  const skills = loadAllSkills();

  if (sources.length === 0 && skills.length === 0) {
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

  if (skills.length > 0) {
    lines.push("[Skills]");
    for (const sk of skills) {
      lines.push(`- ${sk.name}: ${sk.description}`);
    }
    lines.push("");
  }

  lines.push(
    "Use get-capability-guide with slug/name to load full docs or instructions.",
  );

  return { text: lines.join("\n") };
}
