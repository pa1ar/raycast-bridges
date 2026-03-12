import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeCliConfig } from "../lib/clis";
import type { CliConfig } from "../lib/types";

interface Props {
  config: CliConfig;
  onDone: () => void;
}

export function EditCliForm({ config, onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    command: string;
    description: string;
    enabled: string;
  }) {
    const updated: CliConfig = {
      ...config,
      name: values.name.trim(),
      command: values.command.trim(),
      description: values.description.trim() || undefined,
      authType: "none",
      enabled: values.enabled === "true",
      updatedAt: Date.now(),
    };

    writeCliConfig(config.slug, updated);
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
        placeholder="CLI Tool"
        defaultValue={config.name}
      />
      <Form.TextField
        id="command"
        title="Command"
        placeholder="gh"
        defaultValue={config.command}
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="One-line description"
        defaultValue={config.description ?? ""}
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
