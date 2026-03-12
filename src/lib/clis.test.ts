import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("clis", () => {
  let tempClisDir: string;

  beforeEach(() => {
    vi.resetModules();
    tempClisDir = join(tmpdir(), `clis-${Date.now()}`);
    mkdirSync(tempClisDir, { recursive: true });

    vi.doMock("./paths", async (importOriginal) => {
      const orig = (await importOriginal()) as Record<string, unknown>;
      return {
        ...orig,
        CLIS_DIR: tempClisDir,
        cliDir: (slug: string) => join(tempClisDir, slug),
        cliConfigPath: (slug: string) => join(tempClisDir, slug, "config.json"),
        cliGuidePath: (slug: string) => join(tempClisDir, slug, "guide.md"),
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("./paths");
    try {
      rmSync(tempClisDir, { recursive: true });
    } catch {
      /* ignore */
    }
  });

  it("writes and reads CLI config", async () => {
    const { writeCliConfig, readCliConfig } = await import("./clis");

    writeCliConfig("github-cli", {
      slug: "github-cli",
      name: "GitHub CLI",
      description: "GitHub from the command line",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const config = readCliConfig("github-cli");
    expect(config?.slug).toBe("github-cli");
    expect(config?.command).toBe("gh");
    expect(config?.name).toBe("GitHub CLI");
  });

  it("writes and reads CLI guide", async () => {
    const { writeCliGuide, readCliGuide, writeCliConfig } =
      await import("./clis");

    writeCliConfig("gh", {
      slug: "gh",
      name: "GitHub CLI",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    writeCliGuide("gh", "# GitHub CLI\n\nManage repos and PRs.");
    const guide = readCliGuide("gh");
    expect(guide).toContain("GitHub CLI");
    expect(guide).toContain("Manage repos");
  });

  it("lists CLI slugs", async () => {
    const { writeCliConfig, listCliSlugs } = await import("./clis");

    writeCliConfig("gh", {
      slug: "gh",
      name: "GitHub CLI",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    writeCliConfig("vercel", {
      slug: "vercel",
      name: "Vercel CLI",
      command: "vercel",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const slugs = listCliSlugs();
    expect(slugs).toContain("gh");
    expect(slugs).toContain("vercel");
  });

  it("deletes a CLI", async () => {
    const { writeCliConfig, readCliConfig, deleteCli } = await import("./clis");

    writeCliConfig("gh", {
      slug: "gh",
      name: "GitHub CLI",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(readCliConfig("gh")).not.toBeNull();
    deleteCli("gh");
    expect(readCliConfig("gh")).toBeNull();
  });

  it("loadAllClis filters disabled by default", async () => {
    const { writeCliConfig, loadAllClis } = await import("./clis");

    writeCliConfig("gh", {
      slug: "gh",
      name: "GitHub CLI",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    writeCliConfig("vercel", {
      slug: "vercel",
      name: "Vercel CLI",
      command: "vercel",
      authType: "none",
      enabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const enabled = loadAllClis();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].config.slug).toBe("gh");

    const all = loadAllClis(false);
    expect(all).toHaveLength(2);
  });

  it("isAuthenticated is true when authType is none", async () => {
    const { writeCliConfig, loadAllClis } = await import("./clis");

    writeCliConfig("gh", {
      slug: "gh",
      name: "GitHub CLI",
      command: "gh",
      authType: "none",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const clis = loadAllClis();
    expect(clis[0].isAuthenticated).toBe(true);
  });
});
