import { describe, expect, it } from "vitest";

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
