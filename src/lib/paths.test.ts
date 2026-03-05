import { describe, expect, it } from "vitest";
import { homedir } from "os";
import { join } from "path";
import {
  AGENTS_DIR,
  SOURCES_DIR,
  SKILLS_DIR,
  sourceDir,
  sourceConfigPath,
  sourceGuidePath,
  credentialCachePath,
  skillDir,
  skillMdPath,
} from "./paths";

const home = homedir();

describe("paths", () => {
  it("AGENTS_DIR points to ~/.raycast-agents", () => {
    expect(AGENTS_DIR).toBe(join(home, ".raycast-agents"));
  });

  it("SOURCES_DIR is under AGENTS_DIR", () => {
    expect(SOURCES_DIR).toBe(join(home, ".raycast-agents", "sources"));
  });

  it("SKILLS_DIR is under AGENTS_DIR", () => {
    expect(SKILLS_DIR).toBe(join(home, ".raycast-agents", "skills"));
  });

  it("sourceDir returns correct path", () => {
    expect(sourceDir("my-api")).toBe(join(SOURCES_DIR, "my-api"));
  });

  it("sourceConfigPath returns config.json inside source dir", () => {
    expect(sourceConfigPath("my-api")).toBe(
      join(SOURCES_DIR, "my-api", "config.json"),
    );
  });

  it("sourceGuidePath returns guide.md inside source dir", () => {
    expect(sourceGuidePath("my-api")).toBe(
      join(SOURCES_DIR, "my-api", "guide.md"),
    );
  });

  it("credentialCachePath returns .credential-cache.json", () => {
    expect(credentialCachePath("my-api")).toBe(
      join(SOURCES_DIR, "my-api", ".credential-cache.json"),
    );
  });

  it("skillDir returns correct path", () => {
    expect(skillDir("daily-review")).toBe(join(SKILLS_DIR, "daily-review"));
  });

  it("skillMdPath returns SKILL.md inside skill dir", () => {
    expect(skillMdPath("daily-review")).toBe(
      join(SKILLS_DIR, "daily-review", "SKILL.md"),
    );
  });
});
