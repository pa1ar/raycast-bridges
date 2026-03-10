import { loadAllSources } from "../lib/sources";
import { loadAllSkills } from "../lib/skills";

interface Input {
  /** search query — keywords describing what the user wants to do (e.g. "calendar events", "send email", "craft docs") */
  query: string;
}

interface Match {
  slug: string;
  name: string;
  description: string;
  type: "api" | "skill";
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
  const total = sources.length + skills.length;

  if (total === 0) {
    return {
      text: "No capabilities installed. Use the 'Add Capability' command in Raycast to install one.",
    };
  }

  // if few capabilities, skip search and return all
  if (total <= LIST_ALL_THRESHOLD) {
    return { text: formatAll(sources, skills) };
  }

  const queryWords = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (queryWords.length === 0) {
    return { text: formatAll(sources, skills) };
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
        // weight: name/slug/description matches worth more than guide body
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
    const auth =
      m.type === "api"
        ? ` [${m.isAuthenticated ? "authenticated" : "NOT authenticated"}]`
        : "";
    lines.push(`- ${m.slug}: ${m.name} — ${m.description}${auth}`);
  }
  lines.push("");
  lines.push(
    "Use get-capability-guide with the slug to load full docs before making API calls.",
  );

  return { text: lines.join("\n") };
}

function formatAll(
  sources: ReturnType<typeof loadAllSources>,
  skills: ReturnType<typeof loadAllSkills>,
): string {
  const lines: string[] = ["All capabilities (short list):", ""];

  for (const s of sources) {
    lines.push(
      `- ${s.config.slug}: ${s.config.name} — ${s.config.description ?? s.config.baseUrl} [${s.isAuthenticated ? "authenticated" : "NOT authenticated"}]`,
    );
  }
  for (const sk of skills) {
    lines.push(`- ${sk.name}: ${sk.description}`);
  }

  lines.push("");
  lines.push(
    "Use get-capability-guide with the slug to load full docs before making API calls.",
  );
  return lines.join("\n");
}
