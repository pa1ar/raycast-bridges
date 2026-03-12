import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { delimiter, join } from "path";
import { buildEnhancedPath } from "./scaffold-shared";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 50_000;

export interface CliExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function truncate(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text;
  return text.slice(0, maxBytes) + "\n...[truncated]";
}

function resolveCommand(command: string, pathValue: string): string {
  const trimmed = command.trim();
  if (trimmed.includes("/")) return trimmed;

  const match = pathValue
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, trimmed))
    .find((candidate) => existsSync(candidate));

  return match ?? trimmed;
}

function splitArgs(args: string): string[] {
  const result: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

export function execCli(
  command: string,
  args: string,
  timeoutMs?: number,
): CliExecResult {
  const fullPath = buildEnhancedPath();
  const resolved = resolveCommand(command, fullPath);

  const result = spawnSync(resolved, splitArgs(args), {
    timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    encoding: "utf-8",
    maxBuffer: MAX_OUTPUT_BYTES * 2,
    cwd: homedir(),
    env: { ...process.env, PATH: fullPath },
  });

  return {
    stdout: truncate(result.stdout ?? "", MAX_OUTPUT_BYTES),
    stderr: truncate(result.stderr ?? "", MAX_OUTPUT_BYTES),
    exitCode: result.status ?? 1,
  };
}
