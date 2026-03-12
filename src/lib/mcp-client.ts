import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { existsSync } from "fs";
import { createServer } from "http";
import { homedir } from "os";
import { delimiter, join } from "path";
import type { McpConfig } from "./types";

interface McpRequest {
  path: string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpCallOptions {
  timeoutMs?: number;
  credential?: string;
}

interface AuthorizeRemoteMcpOptions {
  openAuthorizationUrl: (url: string) => Promise<void> | void;
  timeoutMs?: number;
}

const MCP_REQUEST_TIMEOUT_MS = 30_000;
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

export async function callMcp(
  config: McpConfig,
  request: McpRequest,
  options: McpCallOptions = {},
): Promise<string> {
  if (config.url?.trim()) {
    return callRemoteMcp(config, request, options);
  }

  const timeoutMs = options.timeoutMs ?? MCP_REQUEST_TIMEOUT_MS;
  const env = buildChildEnv(config.env);
  const command = resolveCommand(config.command, env.PATH);
  const stderrChunks: string[] = [];
  const transport = new StdioClientTransport({
    command,
    args: config.args,
    env,
    stderr: "pipe",
  });

  const stderr = transport.stderr;
  if (stderr) {
    stderr.on("data", (chunk) => {
      stderrChunks.push(String(chunk));
    });
  }

  const client = new Client(
    {
      name: "bridges",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  try {
    await client.connect(transport, { timeout: timeoutMs });
    const result = await routeMcpRequest(client, request, timeoutMs);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderrText = stderrChunks.join("").trim();
    throw new Error(
      stderrText ? `${message}\n\nstderr:\n${stderrText}` : message,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function authorizeRemoteMcp(
  config: McpConfig,
  options: AuthorizeRemoteMcpOptions,
): Promise<{ accessToken: string; expiresAt?: number }> {
  const remoteUrl = getRemoteUrl(config);
  const callback = await createOAuthCallbackServer();
  const provider = new BridgesOAuthProvider(
    config.name,
    callback.redirectUrl,
    options.openAuthorizationUrl,
  );
  const timeoutMs = options.timeoutMs ?? 180_000;

  try {
    await connectRemoteClient(remoteUrl, timeoutMs, {
      authProvider: provider,
      allowAuthRedirect: true,
    });
  } catch (error) {
    if (!(error instanceof RemoteAuthRequiredError)) {
      await callback.close();
      throw error;
    }

    const code = await callback.waitForCode();
    await error.transport.finishAuth(code);
    await error.transport.close().catch(() => undefined);

    const verified = await connectRemoteClient(remoteUrl, timeoutMs, {
      headers: buildRemoteHeaders(config.authType, provider.accessToken),
    });
    await verified.client.close().catch(() => undefined);
  }

  await callback.close();

  if (!provider.accessToken) {
    throw new Error("OAuth completed but no access token was returned");
  }

  return {
    accessToken: provider.accessToken,
    expiresAt: provider.expiresAt,
  };
}

function buildChildEnv(
  extraEnv?: Record<string, string>,
): Record<string, string> {
  const pathEntries = new Set(
    [process.env.PATH, ...COMMON_BIN_DIRS]
      .filter(Boolean)
      .flatMap((value) => String(value).split(delimiter))
      .filter(Boolean),
  );

  return {
    ...process.env,
    ...extraEnv,
    PATH: Array.from(pathEntries).join(delimiter),
  };
}

function resolveCommand(command: string, pathValue?: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("MCP command is empty");
  }

  if (trimmed.includes("/")) {
    return trimmed;
  }

  const candidates = (pathValue || "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, trimmed));

  const match = candidates.find((candidate) => existsSync(candidate));
  if (match) {
    return match;
  }

  return trimmed;
}

async function callRemoteMcp(
  config: McpConfig,
  request: McpRequest,
  options: McpCallOptions,
): Promise<string> {
  const remoteUrl = getRemoteUrl(config);
  const timeoutMs = options.timeoutMs ?? MCP_REQUEST_TIMEOUT_MS;
  const headers = buildRemoteHeaders(config.authType, options.credential);
  const { client } = await connectRemoteClient(remoteUrl, timeoutMs, {
    headers,
  });

  try {
    const result = await routeMcpRequest(client, request, timeoutMs);
    return JSON.stringify(result, null, 2);
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function routeMcpRequest(
  client: Client,
  request: McpRequest,
  timeoutMs: number,
): Promise<unknown> {
  const path = normalizePath(request.path);
  const params = request.params;
  const options = { timeout: timeoutMs };

  if (path === "/ping") {
    return client.ping(options);
  }

  if (path === "/tools" || path === "/tools/list") {
    return client.listTools(asCursorParams(params), options);
  }

  const toolMatch = path.match(/^\/tools\/([^/]+)\/call$/);
  if (toolMatch) {
    return client.callTool(
      {
        name: decodeURIComponent(toolMatch[1]),
        arguments: params,
      },
      undefined,
      options,
    );
  }

  if (path === "/resources" || path === "/resources/list") {
    return client.listResources(asCursorParams(params), options);
  }

  if (
    path === "/resource-templates" ||
    path === "/resources/templates" ||
    path === "/resources/templates/list"
  ) {
    return client.listResourceTemplates(asCursorParams(params), options);
  }

  if (path === "/resources/read") {
    return client.readResource(requireObject(params, "readResource"), options);
  }

  if (path === "/prompts" || path === "/prompts/list") {
    return client.listPrompts(asCursorParams(params), options);
  }

  const promptMatch = path.match(/^\/prompts\/([^/]+)\/get$/);
  if (promptMatch) {
    return client.getPrompt(
      {
        name: decodeURIComponent(promptMatch[1]),
        arguments: asStringRecord(params),
      },
      options,
    );
  }

  throw new Error(
    [
      `Unsupported MCP path: ${request.path}`,
      "Supported paths:",
      "- GET /ping",
      "- GET /tools or /tools/list",
      "- POST /tools/<tool-name>/call",
      "- GET /resources or /resources/list",
      "- GET /resource-templates or /resources/templates",
      "- POST /resources/read",
      "- GET /prompts or /prompts/list",
      "- POST /prompts/<prompt-name>/get",
    ].join("\n"),
  );
}

function normalizePath(path: string): string {
  const trimmed = path.trim() || "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function asCursorParams(
  params?: Record<string, unknown>,
): { cursor?: string } | undefined {
  if (!params) return undefined;
  const cursor = params.cursor;
  if (typeof cursor !== "string" || !cursor) return undefined;
  return { cursor };
}

function requireObject(
  params: Record<string, unknown> | undefined,
  operation: string,
): Record<string, unknown> {
  if (!params) {
    throw new Error(`${operation} requires JSON params`);
  }
  return params;
}

function asStringRecord(
  params?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
  return out;
}

function getRemoteUrl(config: McpConfig): URL {
  if (!config.url?.trim()) {
    throw new Error(`MCP server ${config.name} does not have a remote URL`);
  }
  return new URL(config.url);
}

function buildRemoteHeaders(
  authType: McpConfig["authType"],
  credential?: string,
): Record<string, string> | undefined {
  if (!credential) return undefined;

  if (authType === "bearer" || authType === "oauth") {
    return { Authorization: `Bearer ${credential}` };
  }

  if (authType === "api-key") {
    return { "X-API-Key": credential };
  }

  if (authType === "basic") {
    return {
      Authorization: `Basic ${Buffer.from(credential).toString("base64")}`,
    };
  }

  return undefined;
}

async function connectRemoteClient(
  remoteUrl: URL,
  timeoutMs: number,
  options: {
    headers?: Record<string, string>;
    authProvider?: BridgesOAuthProvider;
    allowAuthRedirect?: boolean;
  },
): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport | SSEClientTransport;
}> {
  const streamable = await tryConnectRemoteTransport(
    remoteUrl,
    timeoutMs,
    "streamable",
    options,
  );
  if (streamable) return streamable;

  const sse = await tryConnectRemoteTransport(
    remoteUrl,
    timeoutMs,
    "sse",
    options,
  );
  if (sse) return sse;

  throw new Error(`Unable to connect to remote MCP server: ${remoteUrl}`);
}

async function tryConnectRemoteTransport(
  remoteUrl: URL,
  timeoutMs: number,
  kind: "streamable" | "sse",
  options: {
    headers?: Record<string, string>;
    authProvider?: BridgesOAuthProvider;
    allowAuthRedirect?: boolean;
  },
): Promise<
  | {
      client: Client;
      transport: StreamableHTTPClientTransport | SSEClientTransport;
    }
  | undefined
> {
  const client = new Client(
    {
      name: "bridges",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  const transport =
    kind === "streamable"
      ? new StreamableHTTPClientTransport(remoteUrl, {
          authProvider: options.authProvider,
          requestInit: options.headers
            ? { headers: options.headers }
            : undefined,
        })
      : new SSEClientTransport(remoteUrl, {
          authProvider: options.authProvider,
          requestInit: options.headers
            ? { headers: options.headers }
            : undefined,
        });

  try {
    await client.connect(transport, { timeout: timeoutMs });
    return { client, transport };
  } catch (error) {
    if (options.allowAuthRedirect && error instanceof UnauthorizedError) {
      throw new RemoteAuthRequiredError(transport);
    }
    await client.close().catch(() => undefined);
    return undefined;
  }
}

class RemoteAuthRequiredError extends Error {
  constructor(
    readonly transport: StreamableHTTPClientTransport | SSEClientTransport,
  ) {
    super("Remote MCP authorization required");
  }
}

class BridgesOAuthProvider {
  private tokensValue?:
    | {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      }
    | undefined;
  private codeVerifierValue?: string;
  private clientInformationValue?: {
    client_id: string;
    client_secret?: string;
  };

  constructor(
    private readonly clientName: string,
    private readonly callbackUrl: string,
    private readonly openAuthorizationUrl: (
      url: string,
    ) => Promise<void> | void,
  ) {}

  get redirectUrl() {
    return this.callbackUrl;
  }

  get clientMetadata() {
    return {
      client_name: `Bridges: ${this.clientName}`,
      redirect_uris: [this.callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none" as const,
    };
  }

  get accessToken() {
    return this.tokensValue?.access_token;
  }

  get expiresAt() {
    if (!this.tokensValue?.expires_in) return undefined;
    return Date.now() + this.tokensValue.expires_in * 1000;
  }

  clientInformation() {
    return this.clientInformationValue;
  }

  saveClientInformation(clientInformation: {
    client_id: string;
    client_secret?: string;
  }) {
    this.clientInformationValue = clientInformation;
  }

  tokens() {
    return this.tokensValue;
  }

  saveTokens(tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }) {
    this.tokensValue = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL) {
    return this.openAuthorizationUrl(authorizationUrl.toString());
  }

  saveCodeVerifier(codeVerifier: string) {
    this.codeVerifierValue = codeVerifier;
  }

  codeVerifier() {
    if (!this.codeVerifierValue) {
      throw new Error("No OAuth code verifier saved");
    }
    return this.codeVerifierValue;
  }

  invalidateCredentials() {
    this.tokensValue = undefined;
    this.codeVerifierValue = undefined;
  }
}

async function createOAuthCallbackServer(): Promise<{
  redirectUrl: string;
  waitForCode: () => Promise<string>;
  close: () => Promise<void>;
}> {
  const server = createServer();

  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const waitForCode = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  server.on("request", (req, res) => {
    try {
      const parsed = new URL(req.url || "/", "http://127.0.0.1");
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><h1>Authorization complete</h1><p>You can close this tab and return to Raycast.</p></body></html>",
        );
        resolveCode(code);
        return;
      }

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<html><body><h1>Authorization failed</h1><p>${error}</p></body></html>`,
        );
        rejectCode(new Error(`OAuth failed: ${error}`));
        return;
      }

      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing code");
    } catch (error) {
      rejectCode(error instanceof Error ? error : new Error(String(error)));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start local OAuth callback server");
  }

  return {
    redirectUrl: `http://127.0.0.1:${address.port}/callback`,
    waitForCode: () => waitForCode,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
