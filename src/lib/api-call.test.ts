import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceConfig } from "./types";
import { callApi } from "./api-call";

function makeConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    slug: "test-api",
    name: "Test API",
    baseUrl: "https://api.example.com",
    authType: "none",
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("callApi", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET with query params", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(makeConfig(), "", {
      path: "/search",
      method: "GET",
      params: { q: "hello", limit: 10 },
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain("/search?");
    expect(url).toContain("q=hello");
    expect(url).toContain("limit=10");
  });

  it("sends POST with JSON body", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve('{"id":1}'),
    });

    await callApi(makeConfig(), "", {
      path: "/items",
      method: "POST",
      params: { name: "test" },
    });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ name: "test" });
  });

  it("adds bearer auth header", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(makeConfig({ authType: "bearer" }), "my-token", {
      path: "/data",
      method: "GET",
    });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe("Bearer my-token");
  });

  it("adds api-key auth header", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(
      makeConfig({ authType: "api-key", apiKeyHeader: "X-Custom-Key" }),
      "secret",
      { path: "/data", method: "GET" },
    );

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers["X-Custom-Key"]).toBe("secret");
  });

  it("adds basic auth header", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(makeConfig({ authType: "basic" }), "user:pass", {
      path: "/data",
      method: "GET",
    });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers["Authorization"]).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );
  });

  it("does not add auth header for authType none", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(makeConfig({ authType: "none" }), "", {
      path: "/data",
      method: "GET",
    });

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.headers["Authorization"]).toBeUndefined();
  });

  it("truncates large responses", async () => {
    const bigBody = "x".repeat(300_000);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(bigBody),
    });

    const result = await callApi(makeConfig(), "", {
      path: "/big",
      method: "GET",
    });

    expect(result.body.length).toBeLessThan(bigBody.length);
    expect(result.body).toContain("[Response truncated");
  });

  it("normalizes URL trailing/leading slashes", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("ok"),
    });

    await callApi(makeConfig({ baseUrl: "https://api.example.com/" }), "", {
      path: "items",
      method: "GET",
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.example.com/items");
  });

  it("returns timeout error on abort", async () => {
    fetchSpy.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        }),
    );

    const result = await callApi(makeConfig(), "", {
      path: "/slow",
      method: "GET",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("timed out");
  });
});
