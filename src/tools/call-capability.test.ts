import { describe, expect, it, vi, beforeEach } from "vitest";

describe("call-capability", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("routes MCP calls through the MCP client", async () => {
    const callMcp = vi.fn().mockResolvedValue('{"ok":true}');

    vi.doMock("../lib/skills", () => ({
      listSkillNames: () => [],
    }));
    vi.doMock("../lib/mcps", () => ({
      readMcpConfig: () => ({
        slug: "craft-docs",
        name: "Craft Docs",
        command: "npx",
        authType: "none",
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    }));
    vi.doMock("../lib/mcp-client", () => ({
      callMcp,
    }));
    vi.doMock("../lib/sources", () => ({
      readCredential: () => null,
      readSourceConfig: () => null,
    }));
    vi.doMock("../lib/api-call", () => ({
      callApi: vi.fn(),
    }));

    const { default: callCapability } = await import("./call-capability");
    const result = await callCapability({
      source: "craft-docs",
      path: "/tools/list_collections/call",
      method: "POST",
      params: "{}",
    });

    expect(callMcp).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "craft-docs" }),
      {
        path: "/tools/list_collections/call",
        method: "POST",
        params: {},
      },
    );
    expect(result.text).toBe('{"ok":true}');
  });

  it("returns invalid JSON before attempting MCP call", async () => {
    const callMcp = vi.fn();

    vi.doMock("../lib/skills", () => ({
      listSkillNames: () => [],
    }));
    vi.doMock("../lib/mcps", () => ({
      readMcpConfig: () => ({
        slug: "craft-docs",
        name: "Craft Docs",
        command: "npx",
        authType: "none",
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    }));
    vi.doMock("../lib/mcp-client", () => ({
      callMcp,
    }));
    vi.doMock("../lib/sources", () => ({
      readCredential: () => null,
      readSourceConfig: () => null,
    }));
    vi.doMock("../lib/api-call", () => ({
      callApi: vi.fn(),
    }));

    const { default: callCapability } = await import("./call-capability");
    const result = await callCapability({
      source: "craft-docs",
      path: "/tools/list_collections/call",
      method: "POST",
      params: "{",
    });

    expect(result.text).toContain("Invalid params JSON");
    expect(callMcp).not.toHaveBeenCalled();
  });
});
