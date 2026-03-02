import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { deleteSource, loadAllSources, readSourceConfig, writeSourceConfig } from "./lib/sources";
import type { AuthType, LoadedSource, SourceConfig } from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";

function EditForm({ config, onDone }: { config: SourceConfig; onDone: () => void }) {
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
      <Form.TextField id="name" title="Name" defaultValue={config.name} />
      <Form.TextField id="baseUrl" title="Base URL" defaultValue={config.baseUrl} />
      <Form.TextField id="description" title="Description" defaultValue={config.description ?? ""} />
      <Form.Dropdown id="authType" title="Auth Type" defaultValue={config.authType}>
        <Form.Dropdown.Item value="bearer" title="Bearer Token" />
        <Form.Dropdown.Item value="api-key" title="API Key (custom header)" />
        <Form.Dropdown.Item value="basic" title="Basic Auth (username:password)" />
        <Form.Dropdown.Item value="none" title="None" />
      </Form.Dropdown>
      <Form.TextField
        id="apiKeyHeader"
        title="API Key Header"
        placeholder="X-Api-Key"
        defaultValue={config.apiKeyHeader ?? ""}
        info="Only used when Auth Type is API Key"
      />
      <Form.Dropdown id="enabled" title="Enabled" defaultValue={String(config.enabled)}>
        <Form.Dropdown.Item value="true" title="Enabled" />
        <Form.Dropdown.Item value="false" title="Disabled" />
      </Form.Dropdown>
    </Form>
  );
}

export default function ManageCapabilities() {
  const [sources, setSources] = useState<LoadedSource[]>(() => loadAllSources());
  const { push } = useNavigation();

  function refresh() {
    setSources(loadAllSources());
  }

  async function handleDelete(slug: string, name: string) {
    const confirmed = await confirmAlert({
      title: `Remove ${name}?`,
      message: "This will delete the capability and its credentials.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    deleteSource(slug);
    await showToast({ style: Toast.Style.Success, title: `${name} removed` });
    refresh();
  }

  async function handleToggle(source: LoadedSource) {
    const config = readSourceConfig(source.config.slug);
    if (!config) return;
    config.enabled = !config.enabled;
    config.updatedAt = Date.now();
    writeSourceConfig(source.config.slug, config);
    refresh();
  }

  if (sources.length === 0) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Plus}
          title="No capabilities installed"
          description="Run 'Add Capability' to add your first API connection."
        />
      </List>
    );
  }

  return (
    <List>
      {sources.map((source) => (
        <List.Item
          key={source.config.slug}
          icon={source.config.enabled ? Icon.Circle : Icon.CircleDisabled}
          title={source.config.name}
          subtitle={source.config.baseUrl}
          accessories={[
            source.isAuthenticated
              ? { tag: { value: "authenticated", color: Color.Green } }
              : { tag: { value: "no credentials", color: Color.Orange } },
          ]}
          actions={
            <ActionPanel>
              <Action
                icon={Icon.Pencil}
                title="Edit"
                onAction={() => push(<EditForm config={source.config} onDone={refresh} />)}
              />
              <Action
                icon={Icon.Key}
                title="Set Credentials"
                onAction={() =>
                  push(<CredentialForm config={source.config} onDone={refresh} onCancel={refresh} />)
                }
              />
              <Action
                icon={source.config.enabled ? Icon.CircleDisabled : Icon.Circle}
                title={source.config.enabled ? "Disable" : "Enable"}
                onAction={() => handleToggle(source)}
              />
              <Action
                icon={Icon.Trash}
                title="Remove"
                style={Action.Style.Destructive}
                onAction={() => handleDelete(source.config.slug, source.config.name)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
