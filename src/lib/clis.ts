import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { CLIS_DIR, cliConfigPath, cliDir, cliGuidePath } from "./paths";
import type { CliConfig, LoadedCli } from "./types";

export function ensureClisDir() {
  mkdirSync(CLIS_DIR, { recursive: true });
}

export function listCliSlugs(): string[] {
  ensureClisDir();
  return readdirSync(CLIS_DIR).filter((entry) => {
    return statSync(join(CLIS_DIR, entry)).isDirectory();
  });
}

export function readCliConfig(slug: string): CliConfig | null {
  const configPath = cliConfigPath(slug);
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as CliConfig;
  } catch {
    return null;
  }
}

export function writeCliConfig(slug: string, config: CliConfig) {
  mkdirSync(cliDir(slug), { recursive: true });
  writeFileSync(cliConfigPath(slug), JSON.stringify(config, null, 2), "utf-8");
}

export function readCliGuide(slug: string): string {
  const guidePath = cliGuidePath(slug);
  if (!existsSync(guidePath)) return "";
  return readFileSync(guidePath, "utf-8");
}

export function writeCliGuide(slug: string, content: string) {
  mkdirSync(cliDir(slug), { recursive: true });
  writeFileSync(cliGuidePath(slug), content, "utf-8");
}

export function deleteCli(slug: string) {
  const dir = cliDir(slug);
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true });
}

export function loadAllClis(enabledOnly = true): LoadedCli[] {
  return listCliSlugs()
    .map((slug) => {
      const config = readCliConfig(slug);
      if (!config) return null;
      if (enabledOnly && !config.enabled) return null;
      const guide = readCliGuide(slug);
      const isAuthenticated = config.authType === "none";
      return { config, guide, isAuthenticated } satisfies LoadedCli;
    })
    .filter((c): c is LoadedCli => c !== null);
}
