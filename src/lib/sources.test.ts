import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { SourceConfig } from "./types";

function makeConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    slug: "test-api",
    name: "Test API",
    baseUrl: "https://api.example.com",
    authType: "bearer",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("sources CRUD", () => {
  let tempDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempDir = join(tmpdir(), `sources-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    vi.doMock("./paths", async (importOriginal) => {
      const orig = (await importOriginal()) as Record<string, unknown>;
      return {
        ...orig,
        SOURCES_DIR: tempDir,
        sourceDir: (slug: string) => join(tempDir, slug),
        sourceConfigPath: (slug: string) => join(tempDir, slug, "config.json"),
        sourceGuidePath: (slug: string) => join(tempDir, slug, "guide.md"),
        credentialCachePath: (slug: string) =>
          join(tempDir, slug, ".credential-cache.json"),
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

  it("write, read, and delete a source", async () => {
    const sources = await import("./sources");
    const config = makeConfig();

    sources.writeSourceConfig("test-api", config);
    const read = sources.readSourceConfig("test-api");
    expect(read).not.toBeNull();
    expect(read!.name).toBe("Test API");
    expect(read!.baseUrl).toBe("https://api.example.com");

    sources.deleteSource("test-api");
    const afterDelete = sources.readSourceConfig("test-api");
    expect(afterDelete).toBeNull();
  });

  it("returns null for nonexistent source", async () => {
    const sources = await import("./sources");
    expect(sources.readSourceConfig("nonexistent")).toBeNull();
  });

  it("writes and reads credentials", async () => {
    const sources = await import("./sources");
    const config = makeConfig();
    sources.writeSourceConfig("test-api", config);
    sources.writeCredential("test-api", "my-secret-token");

    const cred = sources.readCredential("test-api");
    expect(cred).toBe("my-secret-token");
  });

  it("returns null for expired credentials", async () => {
    const sources = await import("./sources");
    const config = makeConfig();
    sources.writeSourceConfig("test-api", config);
    sources.writeCredential("test-api", "expired-token", Date.now() - 1000);

    const cred = sources.readCredential("test-api");
    expect(cred).toBeNull();
  });

  it("loadAllSources filters enabled/disabled", async () => {
    const sources = await import("./sources");

    sources.writeSourceConfig(
      "enabled-api",
      makeConfig({ slug: "enabled-api", enabled: true, authType: "none" }),
    );
    sources.writeSourceConfig(
      "disabled-api",
      makeConfig({ slug: "disabled-api", enabled: false, authType: "none" }),
    );

    const enabledOnly = sources.loadAllSources(true);
    expect(enabledOnly.map((s) => s.config.slug)).toEqual(["enabled-api"]);

    const all = sources.loadAllSources(false);
    expect(all.map((s) => s.config.slug).sort()).toEqual([
      "disabled-api",
      "enabled-api",
    ]);
  });

  it("writes and reads guide", async () => {
    const sources = await import("./sources");
    const config = makeConfig();
    sources.writeSourceConfig("test-api", config);
    sources.writeGuide("test-api", "# Test API Guide\n\nSome content.");

    const guide = sources.readGuide("test-api");
    expect(guide).toBe("# Test API Guide\n\nSome content.");
  });
});
