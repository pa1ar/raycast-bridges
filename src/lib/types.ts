export type AuthType = "bearer" | "api-key" | "basic" | "oauth" | "none";

export interface OAuthConfig {
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes?: string;
}

export interface SourceConfig {
  slug: string;
  name: string;
  description?: string;
  baseUrl: string;
  authType: AuthType;
  // for "api-key" auth: which header to use (default: "X-API-Key")
  apiKeyHeader?: string;
  // for "oauth" auth: OAuth provider config
  oauthConfig?: OAuthConfig;
  // default headers added to every request
  defaultHeaders?: Record<string, string>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialCache {
  value: string;
  expiresAt?: number;
}

export interface LoadedSource {
  config: SourceConfig;
  guide: string;
  isAuthenticated: boolean;
}

export interface SkillInfo {
  name: string;
  description: string;
  content: string;
}

export interface McpConfig {
  slug: string;
  name: string;
  description?: string;
  url?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  authType: AuthType;
  oauthConfig?: OAuthConfig;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LoadedMcp {
  config: McpConfig;
  guide: string;
  isAuthenticated: boolean;
}

export interface CliConfig {
  slug: string;
  name: string;
  description?: string;
  command: string;
  authType: AuthType;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LoadedCli {
  config: CliConfig;
  guide: string;
  isAuthenticated: boolean;
}
