export type AuthType = "bearer" | "api-key" | "basic" | "none";

export interface SourceConfig {
  slug: string;
  name: string;
  description?: string;
  baseUrl: string;
  authType: AuthType;
  // for "api-key" auth: which header to use (default: "X-API-Key")
  apiKeyHeader?: string;
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
