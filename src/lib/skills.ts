import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { SKILLS_DIR, skillDir, skillMdPath } from "./paths";
import type { SkillInfo } from "./types";

export function ensureSkillsDir() {
  mkdirSync(SKILLS_DIR, { recursive: true });
}

export function listSkillNames(): string[] {
  ensureSkillsDir();
  return readdirSync(SKILLS_DIR).filter((entry) => statSync(join(SKILLS_DIR, entry)).isDirectory());
}

export function readSkillMd(name: string): string {
  const p = skillMdPath(name);
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf-8");
}

export function writeSkillMd(name: string, content: string) {
  mkdirSync(skillDir(name), { recursive: true });
  writeFileSync(skillMdPath(name), content, "utf-8");
}

export function parseSkillFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };
  const fm = match[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*["']?(.*?)["']?\s*$/m);
  return {
    name: nameMatch?.[1]?.trim() ?? "",
    description: descMatch?.[1]?.trim() ?? "",
  };
}

export function deleteSkill(name: string) {
  const dir = skillDir(name);
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true });
}

export function loadAllSkills(): SkillInfo[] {
  return listSkillNames().map((name) => {
    const content = readSkillMd(name);
    const { description } = parseSkillFrontmatter(content);
    return { name, description, content };
  });
}
