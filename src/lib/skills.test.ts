import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseSkillFrontmatter } from "./skills";

describe("parseSkillFrontmatter", () => {
  it("parses valid frontmatter", () => {
    const content = `---
name: daily-review
description: "Review today's notes"
---

# daily-review

Some instructions here.`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("daily-review");
    expect(result.description).toBe("Review today's notes");
  });

  it("returns empty strings for missing frontmatter", () => {
    const result = parseSkillFrontmatter("Just some plain text");
    expect(result.name).toBe("");
    expect(result.description).toBe("");
  });

  it("handles frontmatter with no name or description", () => {
    const content = `---
other: value
---

Body content.`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
  });

  it("handles empty content", () => {
    const result = parseSkillFrontmatter("");
    expect(result.name).toBe("");
    expect(result.description).toBe("");
  });

  it("handles description without quotes", () => {
    const content = `---
name: test-skill
description: Do something useful
---`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("test-skill");
    expect(result.description).toBe("Do something useful");
  });
});

describe("skills CRUD", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempDir = join(tmpdir(), `skills-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    vi.doMock("./paths", async (importOriginal) => {
      const orig = (await importOriginal()) as Record<string, unknown>;
      return {
        ...orig,
        SKILLS_DIR: tempDir,
        skillDir: (name: string) => join(tempDir, name),
        skillMdPath: (name: string) => join(tempDir, name, "SKILL.md"),
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("./paths");
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  it("write, read, and delete a skill", async () => {
    const skills = await import("./skills");

    const content = `---
name: test-skill
description: "A test skill"
---

# test-skill

Do the thing.`;

    skills.writeSkillMd("test-skill", content);
    const read = skills.readSkillMd("test-skill");
    expect(read).toBe(content);

    const names = skills.listSkillNames();
    expect(names).toContain("test-skill");

    skills.deleteSkill("test-skill");
    const afterDelete = skills.readSkillMd("test-skill");
    expect(afterDelete).toBe("");
  });
});
