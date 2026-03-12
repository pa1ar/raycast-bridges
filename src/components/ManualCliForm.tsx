import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeCliConfig, writeCliGuide } from "../lib/clis";
import type { CliConfig } from "../lib/types";

interface Props {
  onDone: (config: CliConfig) => void;
}

export function ManualCliForm({ onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    command: string;
    description: string;
  }) {
    const name = values.name.trim();
    if (!name) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Name is required",
      });
      return;
    }

    const command = values.command.trim();
    if (!command) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Command is required",
      });
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const now = Date.now();

    const config: CliConfig = {
      slug,
      name,
      description: values.description.trim() || undefined,
      command,
      authType: "none",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    writeCliConfig(slug, config);
    writeCliGuide(
      slug,
      [
        `# ${name}`,
        "",
        `Command: \`${command}\``,
        "",
        "## Commands",
        "",
        "No commands documented yet. Use 'Edit with AI' to generate documentation.",
      ].join("\n"),
    );

    await showToast({ style: Toast.Style.Success, title: `${name} added` });
    onDone(config);
  }

  return (
    <Form
      navigationTitle="Add CLI Tool Manually"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add CLI Tool" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="GitHub CLI"
        autoFocus
      />
      <Form.TextField
        id="command"
        title="Command"
        placeholder="gh"
        info="The CLI binary name (e.g. gh, vercel, kubectl)"
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="One-line description"
      />
    </Form>
  );
}
