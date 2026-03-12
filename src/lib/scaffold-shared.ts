import { existsSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { delimiter, join } from "path";

const COMMON_BIN_DIRS = [
  join(homedir(), ".nvm/versions/node/v22.18.0/bin"),
  join(homedir(), ".nvm/versions/node/v22/bin"),
  join(homedir(), ".bun/bin"),
  join(homedir(), ".pyenv/shims"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

export function buildEnhancedPath(): string {
  const entries = new Set(
    [process.env.PATH, ...COMMON_BIN_DIRS]
      .filter(Boolean)
      .flatMap((value) => String(value).split(delimiter))
      .filter(Boolean),
  );
  return Array.from(entries).join(delimiter);
}

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
