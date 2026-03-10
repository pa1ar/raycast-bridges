import { describe, expect, it } from "vitest";

// mirrors getAuth() logic from add-capability.tsx
// extracted here so we can test without React/Raycast runtime
function resolveAuth(
  prefs: { scaffoldingAuth: string; anthropicApiKey?: string },
  oauthToken: string | null,
): { apiKey?: string; oauthToken?: string } | null {
  if (prefs.scaffoldingAuth === "api-key") {
    if (prefs.anthropicApiKey) return { apiKey: prefs.anthropicApiKey };
    return null;
  }
  // oauth mode
  if (oauthToken) return { oauthToken };
  return null;
}

// test the env construction logic used by scaffoldSource
// extracted here to verify auth precedence without mocking the agent SDK
function buildScaffoldEnv(auth: { apiKey?: string; oauthToken?: string }) {
  return {
    ...(auth.oauthToken
      ? { CLAUDE_CODE_OAUTH_TOKEN: auth.oauthToken }
      : { ANTHROPIC_API_KEY: auth.apiKey }),
    CLAUDECODE: undefined,
    CLAUDE_CODE_SESSION_ID: undefined,
    CLAUDE_CODE_ENTRYPOINT: undefined,
  };
}

describe("scaffold env construction", () => {
  it("uses oauth token when provided", () => {
    const env = buildScaffoldEnv({ oauthToken: "oauth-tok-123" });
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-tok-123");
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("uses api key when no oauth token", () => {
    const env = buildScaffoldEnv({ apiKey: "sk-ant-123" });
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-123");
    expect(env).not.toHaveProperty("CLAUDE_CODE_OAUTH_TOKEN");
  });

  it("prefers oauth token over api key", () => {
    const env = buildScaffoldEnv({
      oauthToken: "oauth-tok-123",
      apiKey: "sk-ant-123",
    });
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-tok-123");
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("strips nested claude session vars", () => {
    const env = buildScaffoldEnv({ apiKey: "sk-ant-123" });
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined();
  });

  it("handles empty auth gracefully", () => {
    const env = buildScaffoldEnv({});
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env).not.toHaveProperty("CLAUDE_CODE_OAUTH_TOKEN");
  });
});

describe("resolveAuth (pref-driven auth selection)", () => {
  it("returns api key when dropdown is api-key and key is set", () => {
    const auth = resolveAuth(
      { scaffoldingAuth: "api-key", anthropicApiKey: "sk-123" },
      null,
    );
    expect(auth).toEqual({ apiKey: "sk-123" });
  });

  it("returns null when dropdown is api-key but key is empty", () => {
    const auth = resolveAuth({ scaffoldingAuth: "api-key" }, null);
    expect(auth).toBeNull();
  });

  it("ignores oauth token when dropdown is api-key", () => {
    const auth = resolveAuth(
      { scaffoldingAuth: "api-key", anthropicApiKey: "sk-123" },
      "oauth-tok",
    );
    expect(auth).toEqual({ apiKey: "sk-123" });
  });

  it("returns oauth token when dropdown is oauth and token exists", () => {
    const auth = resolveAuth(
      { scaffoldingAuth: "oauth", anthropicApiKey: "sk-123" },
      "oauth-tok",
    );
    expect(auth).toEqual({ oauthToken: "oauth-tok" });
  });

  it("returns null when dropdown is oauth but no token", () => {
    const auth = resolveAuth(
      { scaffoldingAuth: "oauth", anthropicApiKey: "sk-123" },
      null,
    );
    expect(auth).toBeNull();
  });

  it("returns oauth token when dropdown is oauth and no api key", () => {
    const auth = resolveAuth({ scaffoldingAuth: "oauth" }, "oauth-tok");
    expect(auth).toEqual({ oauthToken: "oauth-tok" });
  });
});
