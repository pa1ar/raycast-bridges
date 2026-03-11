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
  SOURCES_DIR,
  credentialCachePath,
  sourceConfigPath,
  sourceDir,
  sourceGuidePath,
} from "./paths";
import type { CredentialCache, LoadedSource, SourceConfig } from "./types";

export function ensureSourcesDir() {
  mkdirSync(SOURCES_DIR, { recursive: true });
}

export function listSlugs(): string[] {
  ensureSourcesDir();
  return readdirSync(SOURCES_DIR).filter((entry) => {
    return statSync(join(SOURCES_DIR, entry)).isDirectory();
  });
}

export function readSourceConfig(slug: string): SourceConfig | null {
  const configPath = sourceConfigPath(slug);
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as SourceConfig;
  } catch {
    return null;
  }
}

export function writeSourceConfig(slug: string, config: SourceConfig) {
  mkdirSync(sourceDir(slug), { recursive: true });
  writeFileSync(
    sourceConfigPath(slug),
    JSON.stringify(config, null, 2),
    "utf-8",
  );
}

export function readGuide(slug: string): string {
  const guidePath = sourceGuidePath(slug);
  if (!existsSync(guidePath)) return "";
  return readFileSync(guidePath, "utf-8");
}

export function writeGuide(slug: string, content: string) {
  mkdirSync(sourceDir(slug), { recursive: true });
  writeFileSync(sourceGuidePath(slug), content, "utf-8");
}

export function readCredential(slug: string): string | null {
  const cachePath = credentialCachePath(slug);
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

export function writeCredential(
  slug: string,
  value: string,
  expiresAt?: number,
) {
  mkdirSync(sourceDir(slug), { recursive: true });
  const cache: CredentialCache = { value, ...(expiresAt ? { expiresAt } : {}) };
  writeFileSync(
    credentialCachePath(slug),
    JSON.stringify(cache, null, 2),
    "utf-8",
  );
}

export function deleteCredential(slug: string) {
  const cachePath = credentialCachePath(slug);
  if (!existsSync(cachePath)) return;
  rmSync(cachePath);
}

export function deleteSource(slug: string) {
  const dir = sourceDir(slug);
  if (!existsSync(dir)) return;
  rmSync(dir, { recursive: true });
}

export function loadAllSources(enabledOnly = true): LoadedSource[] {
  return listSlugs()
    .map((slug) => {
      const config = readSourceConfig(slug);
      if (!config) return null;
      if (enabledOnly && !config.enabled) return null;
      const guide = readGuide(slug);
      const isAuthenticated =
        config.authType === "none" || readCredential(slug) !== null;
      return { config, guide, isAuthenticated } satisfies LoadedSource;
    })
    .filter((s): s is LoadedSource => s !== null);
}
