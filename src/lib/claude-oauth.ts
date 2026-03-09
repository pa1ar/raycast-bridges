import { randomBytes, createHash } from "node:crypto";

export const CLAUDE_OAUTH_CONFIG = {
  CLIENT_ID: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  AUTH_URL: "https://claude.ai/oauth/authorize",
  TOKEN_URL: "https://console.anthropic.com/v1/oauth/token",
  REDIRECT_URI: "https://console.anthropic.com/oauth/code/callback",
  SCOPES: "org:create_api_key user:profile user:inference",
} as const;

const STATE_EXPIRY_MS = 10 * 60 * 1000;

export interface ClaudeTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface OAuthState {
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

let currentState: OAuthState | null = null;

function generatePKCE() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

const TOKEN_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://claude.ai/",
  Origin: "https://claude.ai",
};

// build auth URL + store PKCE state in memory
export function startClaudeOAuth(): string {
  const state = randomBytes(32).toString("hex");
  const { codeVerifier, codeChallenge } = generatePKCE();

  currentState = {
    state,
    codeVerifier,
    expiresAt: Date.now() + STATE_EXPIRY_MS,
  };

  const params = new URLSearchParams({
    code: "true",
    client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
    response_type: "code",
    redirect_uri: CLAUDE_OAUTH_CONFIG.REDIRECT_URI,
    scope: CLAUDE_OAUTH_CONFIG.SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  return `${CLAUDE_OAUTH_CONFIG.AUTH_URL}?${params.toString()}`;
}

// exchange authorization code for tokens
export async function exchangeClaudeCode(code: string): Promise<ClaudeTokens> {
  if (!currentState) {
    throw new Error("No OAuth state. Start the flow first.");
  }
  if (Date.now() > currentState.expiresAt) {
    currentState = null;
    throw new Error("OAuth state expired. Try again.");
  }

  const cleanCode = code.split("#")[0]?.split("&")[0] ?? code;

  const response = await fetch(CLAUDE_OAUTH_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
      code: cleanCode,
      redirect_uri: CLAUDE_OAUTH_CONFIG.REDIRECT_URI,
      code_verifier: currentState.codeVerifier,
      state: currentState.state,
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
    throw new Error(`Token exchange failed: ${response.status} - ${msg}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  currentState = null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
  };
}

// refresh an expired token
export async function refreshClaudeToken(
  refreshToken: string,
): Promise<ClaudeTokens> {
  const response = await fetch(CLAUDE_OAUTH_CONFIG.TOKEN_URL, {
    method: "POST",
    headers: TOKEN_HEADERS,
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLAUDE_OAUTH_CONFIG.CLIENT_ID,
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
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
  };
}

export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  const bufferMs = 5 * 60 * 1000;
  return Date.now() + bufferMs >= expiresAt;
}
