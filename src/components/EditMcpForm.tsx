import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeMcpConfig } from "../lib/mcps";
import type { AuthType, McpConfig } from "../lib/types";

interface Props {
  config: McpConfig;
  onDone: () => void;
}

export function EditMcpForm({ config, onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    command: string;
    args: string;
    envVars: string;
    description: string;
    authType: string;
    enabled: string;
  }) {
    const args = values.args
      .trim()
      .split(/[\n]+/)
      .map((a) => a.trim())
      .filter(Boolean);

    const env: Record<string, string> = {};
    if (values.envVars.trim()) {
      for (const line of values.envVars.trim().split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }
    }

    const updated: McpConfig = {
      ...config,
      name: values.name.trim(),
      command: values.command.trim(),
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      description: values.description.trim() || undefined,
      authType: values.authType as AuthType,
      enabled: values.enabled === "true",
      updatedAt: Date.now(),
    };

    writeMcpConfig(config.slug, updated);
    await showToast({ style: Toast.Style.Success, title: "Saved" });
    onDone();
  }

  const argsDefault = config.args?.join("\n") ?? "";
  const envDefault = config.env
    ? Object.entries(config.env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";

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
        placeholder="MCP Server"
        defaultValue={config.name}
      />
      <Form.TextField
        id="command"
        title="Command"
        placeholder="npx"
        defaultValue={config.command || (config.url ? "npx" : "")}
      />
      <Form.TextArea
        id="args"
        title="Arguments"
        placeholder="One argument per line"
        defaultValue={
          argsDefault || (config.url ? `-y\nmcp-remote\n${config.url}` : "")
        }
      />
      <Form.TextArea
        id="envVars"
        title="Environment Variables"
        placeholder="KEY=VALUE per line"
        defaultValue={envDefault}
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
        <Form.Dropdown.Item value="none" title="None" />
        <Form.Dropdown.Item value="bearer" title="Bearer Token" />
        <Form.Dropdown.Item value="api-key" title="API Key" />
        <Form.Dropdown.Item value="oauth" title="OAuth 2.0" />
      </Form.Dropdown>
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
