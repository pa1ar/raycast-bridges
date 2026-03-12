import { loadAllSources } from "../lib/sources";
import { loadAllSkills } from "../lib/skills";
import { loadAllMcps } from "../lib/mcps";
import { loadAllClis } from "../lib/clis";

interface Input {
  /** search query — keywords describing what the user wants to do (e.g. "calendar events", "send email", "craft docs") */
  query: string;
}

interface Match {
  slug: string;
  name: string;
  description: string;
  type: "api" | "skill" | "mcp" | "cli";
  isAuthenticated?: boolean;
  matchedFields: string[];
  score: number;
}

const LIST_ALL_THRESHOLD = 5;

function searchText(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w));
}

export default async function searchCapabilities(
  input: Input,
): Promise<{ text: string }> {
  const sources = loadAllSources();
  const skills = loadAllSkills();
  const mcps = loadAllMcps();
  const clis = loadAllClis();
  const total = sources.length + skills.length + mcps.length + clis.length;

  if (total === 0) {
    return {
      text: "No capabilities installed. Use the 'Add Capability' command in Raycast to install one.",
    };
  }

  // if few capabilities, skip search and return all
  if (total <= LIST_ALL_THRESHOLD) {
    return { text: formatAll(sources, skills, mcps, clis) };
  }

  const queryWords = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return { text: formatAll(sources, skills, mcps, clis) };
  }

  const matches: Match[] = [];

  for (const s of sources) {
    const fields: [string, string][] = [
      ["slug", s.config.slug],
      ["name", s.config.name],
      ["description", s.config.description ?? ""],
      ["baseUrl", s.config.baseUrl],
      ["guide", s.guide],
    ];

    const matchedFields: string[] = [];
    let score = 0;
    for (const [fieldName, fieldValue] of fields) {
      const hits = searchText(fieldValue, queryWords);
      if (hits.length > 0) {
        matchedFields.push(fieldName);
        const weight = fieldName === "guide" ? 1 : 3;
        score += hits.length * weight;
      }
    }

    if (score > 0) {
      matches.push({
        slug: s.config.slug,
        name: s.config.name,
        description: s.config.description ?? s.config.baseUrl,
        type: "api",
        isAuthenticated: s.isAuthenticated,
        matchedFields,
        score,
      });
    }
  }

  for (const m of mcps) {
    const fields: [string, string][] = [
      ["slug", m.config.slug],
      ["name", m.config.name],
      ["description", m.config.description ?? ""],
      ["command", m.config.command],
      ["guide", m.guide],
    ];

    const matchedFields: string[] = [];
    let score = 0;
    for (const [fieldName, fieldValue] of fields) {
      const hits = searchText(fieldValue, queryWords);
      if (hits.length > 0) {
        matchedFields.push(fieldName);
        const weight = fieldName === "guide" ? 1 : 3;
        score += hits.length * weight;
      }
    }

    if (score > 0) {
      matches.push({
        slug: m.config.slug,
        name: m.config.name,
        description: m.config.description ?? m.config.command,
        type: "mcp",
        isAuthenticated: m.isAuthenticated,
        matchedFields,
        score,
      });
    }
  }

  for (const c of clis) {
    const fields: [string, string][] = [
      ["slug", c.config.slug],
      ["name", c.config.name],
      ["description", c.config.description ?? ""],
      ["command", c.config.command],
      ["guide", c.guide],
    ];

    const matchedFields: string[] = [];
    let score = 0;
    for (const [fieldName, fieldValue] of fields) {
      const hits = searchText(fieldValue, queryWords);
      if (hits.length > 0) {
        matchedFields.push(fieldName);
        const weight = fieldName === "guide" ? 1 : 3;
        score += hits.length * weight;
      }
    }

    if (score > 0) {
      matches.push({
        slug: c.config.slug,
        name: c.config.name,
        description: c.config.description ?? c.config.command,
        type: "cli",
        isAuthenticated: c.isAuthenticated,
        matchedFields,
        score,
      });
    }
  }

  for (const sk of skills) {
    const fields: [string, string][] = [
      ["name", sk.name],
      ["description", sk.description],
      ["content", sk.content],
    ];

    const matchedFields: string[] = [];
    let score = 0;
    for (const [fieldName, fieldValue] of fields) {
      const hits = searchText(fieldValue, queryWords);
      if (hits.length > 0) {
        matchedFields.push(fieldName);
        const weight = fieldName === "content" ? 1 : 3;
        score += hits.length * weight;
      }
    }

    if (score > 0) {
      matches.push({
        slug: sk.name,
        name: sk.name,
        description: sk.description,
        type: "skill",
        matchedFields,
        score,
      });
    }
  }

  // sort by score descending
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    return {
      text: [
        `No capabilities matched "${input.query}".`,
        "",
        "Use list-capabilities to see all available capabilities, or try different search terms.",
      ].join("\n"),
    };
  }

  const lines: string[] = [`Capabilities matching "${input.query}":`, ""];
  for (const m of matches) {
    const typeTag =
      m.type === "mcp" ? " [MCP]" : m.type === "cli" ? " [CLI]" : "";
    const auth =
      m.type === "api" || m.type === "mcp"
        ? ` [${m.isAuthenticated ? "authenticated" : "NOT authenticated"}]`
        : "";
    lines.push(`- ${m.slug}: ${m.name}${typeTag} — ${m.description}${auth}`);
  }
  lines.push("");
  lines.push(
    "Use get-capability-guide with the slug first. Then call-capability: REST paths for APIs, MCP pseudo-paths for MCP servers, subcommand+flags as path for CLI tools.",
  );

  return { text: lines.join("\n") };
}

function formatAll(
  sources: ReturnType<typeof loadAllSources>,
  skills: ReturnType<typeof loadAllSkills>,
  mcps: ReturnType<typeof loadAllMcps>,
  clis: ReturnType<typeof loadAllClis>,
): string {
  const lines: string[] = ["All capabilities (short list):", ""];

  for (const s of sources) {
    lines.push(
      `- ${s.config.slug}: ${s.config.name} — ${s.config.description ?? s.config.baseUrl} [${s.isAuthenticated ? "authenticated" : "NOT authenticated"}]`,
    );
  }
  for (const m of mcps) {
    lines.push(
      `- ${m.config.slug}: ${m.config.name} [MCP] — ${m.config.description ?? m.config.command} [${m.isAuthenticated ? "ready" : "needs setup"}]`,
    );
  }
  for (const c of clis) {
    lines.push(
      `- ${c.config.slug}: ${c.config.name} [CLI] — ${c.config.description ?? c.config.command}`,
    );
  }
  for (const sk of skills) {
    lines.push(`- ${sk.name}: ${sk.description}`);
  }

  lines.push("");
  lines.push(
    "Use get-capability-guide with the slug first. Then call-capability: REST paths for APIs, MCP pseudo-paths for MCP servers, subcommand+flags as path for CLI tools.",
  );
  return lines.join("\n");
}
