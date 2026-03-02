import type { SourceConfig } from "./types";

export interface ApiCallArgs {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  params?: Record<string, unknown>;
}

export interface ApiCallResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

const TIMEOUT_MS = 30_000;

function buildUrl(config: SourceConfig, path: string, method: string, params?: Record<string, unknown>): string {
  const base = config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url = `${base}${normalizedPath}`;

  if (method === "GET" && params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        qs.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }
    const queryString = qs.toString();
    if (queryString) url += (url.includes("?") ? "&" : "?") + queryString;
  }

  return url;
}

function buildHeaders(config: SourceConfig, credential: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...config.defaultHeaders };

  if (config.authType === "none" || !credential) return headers;

  if (config.authType === "bearer") {
    headers["Authorization"] = `Bearer ${credential}`;
  } else if (config.authType === "api-key") {
    headers[config.apiKeyHeader || "X-API-Key"] = credential;
  } else if (config.authType === "basic") {
    // credential stored as "username:password"
    headers["Authorization"] = `Basic ${Buffer.from(credential).toString("base64")}`;
  }

  return headers;
}

export async function callApi(
  config: SourceConfig,
  credential: string,
  args: ApiCallArgs,
): Promise<ApiCallResult> {
  const { path, method, params } = args;
  const url = buildUrl(config, path, method, params);
  const headers = buildHeaders(config, credential);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (method !== "GET" && params && Object.keys(params).length > 0) {
    fetchOpts.body = JSON.stringify(params);
  }

  try {
    const response = await fetch(url, fetchOpts);
    clearTimeout(timer);
    const body = await response.text();

    // truncate very large responses
    const truncated = body.length > 200_000
      ? body.slice(0, 200_000) + `\n\n[Response truncated — ${Math.round(body.length / 1024)}KB total]`
      : body;

    return { ok: response.ok, status: response.status, body: truncated };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      body: "",
      error: isTimeout ? `Request timed out after ${TIMEOUT_MS / 1000}s` : String(err),
    };
  }
}
