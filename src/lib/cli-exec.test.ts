import { describe, expect, it } from "vitest";
import { execCli } from "./cli-exec";

describe("cli-exec", () => {
  it("executes a simple command", () => {
    const result = execCli("echo", "hello world");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello world");
  });

  it("returns exit code on failure", () => {
    const result = execCli("false", "");
    expect(result.exitCode).not.toBe(0);
  });

  it("captures stderr", () => {
    const result = execCli("sh", "-c 'echo err >&2'");
    expect(result.stderr.trim()).toBe("err");
  });

  it("truncates long output", () => {
    // generate output > 50KB
    const result = execCli(
      "sh",
      `-c 'for i in $(seq 1 10000); do echo "line $i padding padding padding padding"; done'`,
    );
    expect(result.stdout.length).toBeLessThanOrEqual(50_020);
    if (result.stdout.length > 50_000) {
      expect(result.stdout).toContain("...[truncated]");
    }
  });
});
