import { homedir } from "os";
import { join } from "path";

export const AGENTS_DIR = join(homedir(), ".bridges");
export const SOURCES_DIR = join(AGENTS_DIR, "sources");
export const SKILLS_DIR = join(AGENTS_DIR, "skills");
export const MCPS_DIR = join(AGENTS_DIR, "mcps");
export const CLIS_DIR = join(AGENTS_DIR, "clis");

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

export function mcpDir(slug: string) {
  return join(MCPS_DIR, slug);
}

export function mcpConfigPath(slug: string) {
  return join(mcpDir(slug), "config.json");
}

export function mcpGuidePath(slug: string) {
  return join(mcpDir(slug), "guide.md");
}

export function mcpCredentialCachePath(slug: string) {
  return join(mcpDir(slug), ".credential-cache.json");
}

export function cliDir(slug: string) {
  return join(CLIS_DIR, slug);
}

export function cliConfigPath(slug: string) {
  return join(cliDir(slug), "config.json");
}

export function cliGuidePath(slug: string) {
  return join(cliDir(slug), "guide.md");
}
