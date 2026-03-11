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
import {
  MCPS_DIR,
  mcpConfigPath,
  mcpCredentialCachePath,
  mcpDir,
  mcpGuidePath,
} from "./paths";
import type { CredentialCache, LoadedMcp, McpConfig } from "./types";

function normalizeMcpConfig(config: McpConfig): McpConfig {
  if ((!config.command || !config.command.trim()) && config.url?.trim()) {
    return {
      ...config,
      command: "npx",
      args: ["-y", "mcp-remote", config.url.trim()],
    };
  }
  return config;
}

export function ensureMcpsDir() {
  mkdirSync(MCPS_DIR, { recursive: true });
}

export function listMcpSlugs(): string[] {
  ensureMcpsDir();
  return readdirSync(MCPS_DIR).filter((entry) => {
    return statSync(join(MCPS_DIR, entry)).isDirectory();
  });
}

export function readMcpConfig(slug: string): McpConfig | null {
  const configPath = mcpConfigPath(slug);
  if (!existsSync(configPath)) return null;
  try {
    return normalizeMcpConfig(
      JSON.parse(readFileSync(configPath, "utf-8")) as McpConfig,
    );
  } catch {
    return null;
  }
}

export function writeMcpConfig(slug: string, config: McpConfig) {
  mkdirSync(mcpDir(slug), { recursive: true });
  writeFileSync(
    mcpConfigPath(slug),
    JSON.stringify(normalizeMcpConfig(config), null, 2),
    "utf-8",
  );
}

export function readMcpGuide(slug: string): string {
  const guidePath = mcpGuidePath(slug);
  if (!existsSync(guidePath)) return "";
  return readFileSync(guidePath, "utf-8");
}

export function writeMcpGuide(slug: string, content: string) {
  mkdirSync(mcpDir(slug), { recursive: true });
  writeFileSync(mcpGuidePath(slug), content, "utf-8");
}

export function readMcpCredential(slug: string): string | null {
  const cachePath = mcpCredentialCachePath(slug);
  if (!existsSync(cachePath)) return null;
  try {
    const cache = JSON.parse(
      readFileSync(cachePath, "utf-8"),
    ) as CredentialCache;
    if (cache.expiresAt && Date.now() > cache.expiresAt) return null;
    return cache.value || null;
  } catch {
    return null;
  }
}

export function writeMcpCredential(
  slug: string,
  value: string,
  expiresAt?: number,
) {
  mkdirSync(mcpDir(slug), { recursive: true });
  const cache: CredentialCache = { value, ...(expiresAt ? { expiresAt } : {}) };
  writeFileSync(
    mcpCredentialCachePath(slug),
    JSON.stringify(cache, null, 2),
    "utf-8",
  );
}

export function deleteMcpCredential(slug: string) {
  const cachePath = mcpCredentialCachePath(slug);
  if (!existsSync(cachePath)) return;
  rmSync(cachePath);
}

export function deleteMcp(slug: string) {
  const dir = mcpDir(slug);
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true });
}

export function loadAllMcps(enabledOnly = true): LoadedMcp[] {
  return listMcpSlugs()
    .map((slug) => {
      const config = readMcpConfig(slug);
      if (!config) return null;
      if (enabledOnly && !config.enabled) return null;
      const guide = readMcpGuide(slug);
      const isAuthenticated =
        config.authType === "none" || readMcpCredential(slug) !== null;
      return { config, guide, isAuthenticated } satisfies LoadedMcp;
    })
    .filter((m): m is LoadedMcp => m !== null);
}
