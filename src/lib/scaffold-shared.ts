import { existsSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const SCAFFOLD_LOG = join(homedir(), ".bridges", "scaffold.log");

export function appendLog(msg: string) {
  try {
    mkdirSync(join(homedir(), ".bridges"), { recursive: true });
    writeFileSync(SCAFFOLD_LOG, `${new Date().toISOString()} ${msg}\n`, {
      flag: "a",
    });
  } catch {
    /* ignore */
  }
}

export function findClaude(): string | null {
  const candidates = [
    join(homedir(), ".local/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    /* ignore */
  }
  return null;
}
