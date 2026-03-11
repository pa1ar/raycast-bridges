import { randomBytes, createHash } from "node:crypto";
import type { OAuthConfig } from "./types";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface OAuthState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
  config: OAuthConfig;
}

const STATE_EXPIRY_MS = 10 * 60 * 1000;

// in-memory state store keyed by state param
const pendingStates = new Map<string, OAuthState>();

function generatePKCE() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

// build auth URL + store PKCE state in memory
export function startOAuth(config: OAuthConfig): string {
  const state = randomBytes(32).toString("hex");
  const { codeVerifier, codeChallenge } = generatePKCE();

  pendingStates.set(state, {
    state,
    codeVerifier,
    expiresAt: Date.now() + STATE_EXPIRY_MS,
    config,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  if (config.scopes) {
    params.set("scope", config.scopes);
  }

  return `${config.authUrl}?${params.toString()}`;
}

// exchange authorization code for tokens
export async function exchangeCode(code: string): Promise<OAuthTokens> {
  // find the most recent pending state
  let found: OAuthState | null = null;
  for (const [key, s] of pendingStates) {
    if (Date.now() > s.expiresAt) {
      pendingStates.delete(key);
      continue;
    }
    found = s;
  }

  if (!found) {
    throw new Error("No OAuth state. Start the flow first.");
  }

  const cleanCode = code.split("#")[0]?.split("&")[0] ?? code;

  const response = await fetch(found.config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: found.config.clientId,
      code: cleanCode,
      redirect_uri: found.config.redirectUri,
      code_verifier: found.codeVerifier,
      state: found.state,
    }),
  });

  pendingStates.delete(found.state);

  if (!response.ok) {
    const text = await response.text();
    let msg: string;
    try {
      const json = JSON.parse(text);
      msg = json.error_description || json.error || text;
    } catch {
      msg = text;
    }
    throw new Error(`Token exchange failed: ${response.status} - ${msg}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
  };
}

// refresh an expired token
export async function refreshToken(
  config: OAuthConfig,
  currentRefreshToken: string,
): Promise<OAuthTokens> {
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken,
      client_id: config.clientId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let msg: string;
    try {
      const json = JSON.parse(text);
      msg = json.error_description || json.error || text;
    } catch {
      msg = text;
    }
    throw new Error(`Token refresh failed: ${response.status} - ${msg}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || currentRefreshToken,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
  };
}
