import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("mcps", () => {
  let tempMcpsDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempMcpsDir = join(tmpdir(), `mcps-${Date.now()}`);
    mkdirSync(tempMcpsDir, { recursive: true });

    vi.doMock("./paths", async (importOriginal) => {
      const orig = (await importOriginal()) as Record<string, unknown>;
      return {
        ...orig,
        MCPS_DIR: tempMcpsDir,
        mcpDir: (slug: string) => join(tempMcpsDir, slug),
        mcpConfigPath: (slug: string) => join(tempMcpsDir, slug, "config.json"),
        mcpGuidePath: (slug: string) => join(tempMcpsDir, slug, "guide.md"),
        mcpCredentialCachePath: (slug: string) =>
          join(tempMcpsDir, slug, ".credential-cache.json"),
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("./paths");
    try {
      rmSync(tempMcpsDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  it("normalizes url-only MCP configs to mcp-remote command", async () => {
    const { writeMcpConfig, readMcpConfig } = await import("./mcps");

    writeMcpConfig("craft-docs", {
      slug: "craft-docs",
      name: "Craft Docs",
      url: "https://mcp.craft.do/links/test/mcp",
      command: "",
      args: [],
      authType: "oauth",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const config = readMcpConfig("craft-docs");
    expect(config?.command).toBe("npx");
    expect(config?.args).toEqual([
      "-y",
      "mcp-remote",
      "https://mcp.craft.do/links/test/mcp",
    ]);
  });
});
