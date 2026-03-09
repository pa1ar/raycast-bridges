import { LocalStorage } from "@raycast/api";
import {
  isTokenExpired,
  refreshClaudeToken,
  type ClaudeTokens,
} from "./claude-oauth";

const KEYS = {
  accessToken: "claude_oauth_access_token",
  refreshToken: "claude_oauth_refresh_token",
  expiresAt: "claude_oauth_expires_at",
} as const;

export async function saveClaudeTokens(tokens: ClaudeTokens): Promise<void> {
  await LocalStorage.setItem(KEYS.accessToken, tokens.accessToken);
  if (tokens.refreshToken) {
    await LocalStorage.setItem(KEYS.refreshToken, tokens.refreshToken);
  }
  if (tokens.expiresAt) {
    await LocalStorage.setItem(KEYS.expiresAt, String(tokens.expiresAt));
  }
}

export async function loadClaudeTokens(): Promise<ClaudeTokens | null> {
  const accessToken = await LocalStorage.getItem<string>(KEYS.accessToken);
  if (!accessToken) return null;

  const refreshToken = await LocalStorage.getItem<string>(KEYS.refreshToken);
  const expiresAtStr = await LocalStorage.getItem<string>(KEYS.expiresAt);
  const expiresAt = expiresAtStr ? Number(expiresAtStr) : undefined;

  return { accessToken, refreshToken: refreshToken ?? undefined, expiresAt };
}

export async function clearClaudeTokens(): Promise<void> {
  await LocalStorage.removeItem(KEYS.accessToken);
  await LocalStorage.removeItem(KEYS.refreshToken);
  await LocalStorage.removeItem(KEYS.expiresAt);
}

// mutex to prevent concurrent refreshes
let refreshPromise: Promise<string | null> | null = null;

export async function getValidToken(): Promise<string | null> {
  const tokens = await loadClaudeTokens();
  if (!tokens) return null;

  if (!isTokenExpired(tokens.expiresAt)) {
    return tokens.accessToken;
  }

  // need refresh
  if (!tokens.refreshToken) return null;

  // deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshed = await refreshClaudeToken(tokens.refreshToken!);
      await saveClaudeTokens(refreshed);
      return refreshed.accessToken;
    } catch {
      // refresh failed — token is invalid
      await clearClaudeTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
