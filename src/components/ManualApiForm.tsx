import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeGuide, writeSourceConfig } from "../lib/sources";
import type { AuthType, OAuthConfig, SourceConfig } from "../lib/types";

interface Props {
  onDone: (config: SourceConfig) => void;
}

export function ManualApiForm({ onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    baseUrl: string;
    description: string;
    authType: string;
    apiKeyHeader: string;
    // oauth fields
    oauthClientId: string;
    oauthAuthUrl: string;
    oauthTokenUrl: string;
    oauthRedirectUri: string;
    oauthScopes: string;
  }) {
    const name = values.name.trim();
    if (!name) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Name is required",
      });
      return;
    }

    const baseUrl = values.baseUrl.trim().replace(/\/$/, "");
    if (!baseUrl) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Base URL is required",
      });
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const authType = values.authType as AuthType;
    const now = Date.now();

    let oauthConfig: OAuthConfig | undefined;
    if (authType === "oauth") {
      if (
        !values.oauthClientId ||
        !values.oauthAuthUrl ||
        !values.oauthTokenUrl
      ) {
        await showToast({
          style: Toast.Style.Failure,
          title: "OAuth fields required",
          message: "Client ID, Auth URL, and Token URL are required for OAuth",
        });
        return;
      }
      oauthConfig = {
        clientId: values.oauthClientId.trim(),
        authUrl: values.oauthAuthUrl.trim(),
        tokenUrl: values.oauthTokenUrl.trim(),
        redirectUri:
          values.oauthRedirectUri.trim() ||
          `${values.oauthAuthUrl.trim().replace(/\/authorize.*/, "")}/callback`,
        scopes: values.oauthScopes.trim() || undefined,
      };
    }

    const config: SourceConfig = {
      slug,
      name,
      description: values.description.trim() || undefined,
      baseUrl,
      authType,
      apiKeyHeader:
        authType === "api-key"
          ? values.apiKeyHeader.trim() || "X-API-Key"
          : undefined,
      oauthConfig,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    writeSourceConfig(slug, config);
    writeGuide(
      slug,
      [
        `# ${name} API`,
        "",
        `Base URL: ${baseUrl}`,
        "",
        "## Endpoints",
        "",
        "No endpoints documented yet. Use 'Edit with AI' to generate API documentation.",
      ].join("\n"),
    );

    await showToast({ style: Toast.Style.Success, title: `${name} added` });
    onDone(config);
  }

  return (
    <Form
      navigationTitle="Add API Manually"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add API" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" placeholder="My API" autoFocus />
      <Form.TextField
        id="baseUrl"
        title="Base URL"
        placeholder="https://api.example.com/v1"
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="One-line description of what this API does"
      />
      <Form.Dropdown id="authType" title="Auth Type" defaultValue="bearer">
        <Form.Dropdown.Item value="bearer" title="Bearer Token" />
        <Form.Dropdown.Item value="api-key" title="API Key (custom header)" />
        <Form.Dropdown.Item
          value="basic"
          title="Basic Auth (username:password)"
        />
        <Form.Dropdown.Item value="oauth" title="OAuth 2.0" />
        <Form.Dropdown.Item value="none" title="None" />
      </Form.Dropdown>
      <Form.TextField
        id="apiKeyHeader"
        title="API Key Header"
        placeholder="X-Api-Key"
        info="Only used when Auth Type is API Key"
      />
      <Form.Separator />
      <Form.Description
        title="OAuth Settings"
        text="Only needed when Auth Type is OAuth 2.0"
      />
      <Form.TextField
        id="oauthClientId"
        title="Client ID"
        placeholder="your-client-id"
      />
      <Form.TextField
        id="oauthAuthUrl"
        title="Auth URL"
        placeholder="https://provider.com/oauth/authorize"
      />
      <Form.TextField
        id="oauthTokenUrl"
        title="Token URL"
        placeholder="https://provider.com/oauth/token"
      />
      <Form.TextField
        id="oauthRedirectUri"
        title="Redirect URI"
        placeholder="https://provider.com/callback"
        info="Where the provider redirects after login. Must show a code you can copy."
      />
      <Form.TextField
        id="oauthScopes"
        title="Scopes"
        placeholder="read write"
        info="Space-separated OAuth scopes"
      />
    </Form>
  );
}
