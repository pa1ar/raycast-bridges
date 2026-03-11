import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeSourceConfig } from "../lib/sources";
import type { AuthType, SourceConfig } from "../lib/types";

interface Props {
  config: SourceConfig;
  onDone: () => void;
}

export function EditSourceForm({ config, onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    baseUrl: string;
    description: string;
    authType: string;
    apiKeyHeader: string;
    enabled: string;
  }) {
    const updated: SourceConfig = {
      ...config,
      name: values.name.trim(),
      baseUrl: values.baseUrl.trim().replace(/\/$/, ""),
      description: values.description.trim(),
      authType: values.authType as AuthType,
      apiKeyHeader: values.apiKeyHeader.trim() || undefined,
      enabled: values.enabled === "true",
      updatedAt: Date.now(),
    };
    writeSourceConfig(config.slug, updated);
    await showToast({ style: Toast.Style.Success, title: "Saved" });
    onDone();
  }

  return (
    <Form
      navigationTitle={`Edit ${config.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="My API"
        defaultValue={config.name}
      />
      <Form.TextField
        id="baseUrl"
        title="Base URL"
        placeholder="https://api.example.com/v1"
        defaultValue={config.baseUrl}
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="One-line description"
        defaultValue={config.description ?? ""}
      />
      <Form.Dropdown
        id="authType"
        title="Auth Type"
        defaultValue={config.authType}
      >
        <Form.Dropdown.Item value="bearer" title="Bearer Token" />
        <Form.Dropdown.Item value="api-key" title="API Key (custom header)" />
        <Form.Dropdown.Item
          value="basic"
          title="Basic Auth (username:password)"
        />
        <Form.Dropdown.Item value="none" title="None" />
      </Form.Dropdown>
      <Form.TextField
        id="apiKeyHeader"
        title="API Key Header"
        placeholder="X-Api-Key"
        defaultValue={config.apiKeyHeader ?? ""}
        info="Only used when Auth Type is API Key"
      />
      <Form.Dropdown
        id="enabled"
        title="Enabled"
        defaultValue={String(config.enabled)}
      >
        <Form.Dropdown.Item value="true" title="Enabled" />
        <Form.Dropdown.Item value="false" title="Disabled" />
      </Form.Dropdown>
    </Form>
  );
}
