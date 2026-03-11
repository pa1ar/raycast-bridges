import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { SourceConfig } from "../lib/types";

function makeConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    slug: "test-api",
    name: "Test API",
    description: "A test API for unit testing",
    baseUrl: "https://api.example.com",
    authType: "none",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("search-capabilities", () => {
  let tempSourcesDir: string;
  let tempSkillsDir: string;
  let tempMcpsDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempSourcesDir = join(tmpdir(), `search-sources-${Date.now()}`);
    tempSkillsDir = join(tmpdir(), `search-skills-${Date.now()}`);
    tempMcpsDir = join(tmpdir(), `search-mcps-${Date.now()}`);
    mkdirSync(tempSourcesDir, { recursive: true });
    mkdirSync(tempSkillsDir, { recursive: true });
    mkdirSync(tempMcpsDir, { recursive: true });

    vi.doMock("../lib/paths", async (importOriginal) => {
      const orig = (await importOriginal()) as Record<string, unknown>;
      return {
        ...orig,
        SOURCES_DIR: tempSourcesDir,
        SKILLS_DIR: tempSkillsDir,
        sourceDir: (slug: string) => join(tempSourcesDir, slug),
        sourceConfigPath: (slug: string) =>
          join(tempSourcesDir, slug, "config.json"),
        sourceGuidePath: (slug: string) =>
          join(tempSourcesDir, slug, "guide.md"),
        credentialCachePath: (slug: string) =>
          join(tempSourcesDir, slug, ".credential-cache.json"),
        MCPS_DIR: tempMcpsDir,
        mcpDir: (slug: string) => join(tempMcpsDir, slug),
        mcpConfigPath: (slug: string) => join(tempMcpsDir, slug, "config.json"),
        mcpGuidePath: (slug: string) => join(tempMcpsDir, slug, "guide.md"),
        mcpCredentialCachePath: (slug: string) =>
          join(tempMcpsDir, slug, ".credential-cache.json"),
        skillDir: (name: string) => join(tempSkillsDir, name),
        skillMdPath: (name: string) => join(tempSkillsDir, name, "SKILL.md"),
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("../lib/paths");
    try {
      rmSync(tempSourcesDir, { recursive: true });
    } catch {
      /* ignore */
    }
    try {
      rmSync(tempSkillsDir, { recursive: true });
    } catch {
      /* ignore */
    }
    try {
      rmSync(tempMcpsDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  it("returns empty message when no capabilities installed", async () => {
    const { default: search } = await import("./search-capabilities");
    const result = await search({ query: "anything" });
    expect(result.text).toContain("No capabilities installed");
  });

  it("returns all when total <= threshold", async () => {
    const sources = await import("../lib/sources");
    sources.writeSourceConfig(
      "alpha",
      makeConfig({ slug: "alpha", name: "Alpha API", description: "first" }),
    );
    sources.writeSourceConfig(
      "beta",
      makeConfig({ slug: "beta", name: "Beta API", description: "second" }),
    );

    const { default: search } = await import("./search-capabilities");
    const result = await search({ query: "unrelated-query" });
    expect(result.text).toContain("All capabilities");
    expect(result.text).toContain("alpha");
    expect(result.text).toContain("beta");
  });

  it("searches and ranks by relevance", async () => {
    const sources = await import("../lib/sources");
    // create 6 sources to exceed threshold
    for (let i = 0; i < 6; i++) {
      sources.writeSourceConfig(
        `api-${i}`,
        makeConfig({
          slug: `api-${i}`,
          name: `API ${i}`,
          description:
            i === 0 ? "calendar events manager" : `generic service ${i}`,
        }),
      );
    }
    // add guide with "calendar" in it for api-1
    sources.writeGuide("api-1", "# API 1 Guide\n\nManage calendar entries.");

    const { default: search } = await import("./search-capabilities");
    const result = await search({ query: "calendar" });

    expect(result.text).toContain("api-0"); // matches description
    expect(result.text).toContain("api-1"); // matches guide
    // api-0 should rank higher (description match = 3x weight vs guide = 1x)
    const idx0 = result.text.indexOf("api-0");
    const idx1 = result.text.indexOf("api-1");
    expect(idx0).toBeLessThan(idx1);
  });

  it("returns no-match message when nothing matches", async () => {
    const sources = await import("../lib/sources");
    for (let i = 0; i < 6; i++) {
      sources.writeSourceConfig(
        `api-${i}`,
        makeConfig({
          slug: `api-${i}`,
          name: `API ${i}`,
          description: `service ${i}`,
        }),
      );
    }

    const { default: search } = await import("./search-capabilities");
    const result = await search({ query: "zzzznonexistent" });
    expect(result.text).toContain("No capabilities matched");
    expect(result.text).toContain("list-capabilities");
  });

  it("returns all when query is empty", async () => {
    const sources = await import("../lib/sources");
    for (let i = 0; i < 6; i++) {
      sources.writeSourceConfig(
        `api-${i}`,
        makeConfig({ slug: `api-${i}`, name: `API ${i}` }),
      );
    }

    const { default: search } = await import("./search-capabilities");
    const result = await search({ query: "" });
    expect(result.text).toContain("All capabilities");
  });
});
