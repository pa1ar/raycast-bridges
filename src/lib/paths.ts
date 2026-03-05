import { homedir } from "os";
import { join } from "path";

export const AGENTS_DIR = join(homedir(), ".raycast-agents");
export const SOURCES_DIR = join(AGENTS_DIR, "sources");
export const SKILLS_DIR = join(AGENTS_DIR, "skills");

export function sourceDir(slug: string) {
  return join(SOURCES_DIR, slug);
}

export function sourceConfigPath(slug: string) {
  return join(sourceDir(slug), "config.json");
}

export function sourceGuidePath(slug: string) {
  return join(sourceDir(slug), "guide.md");
}

export function credentialCachePath(slug: string) {
  return join(sourceDir(slug), ".credential-cache.json");
}

export function skillDir(name: string) {
  return join(SKILLS_DIR, name);
}

export function skillMdPath(name: string) {
  return join(skillDir(name), "SKILL.md");
}
