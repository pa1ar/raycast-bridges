import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeMcpConfig, writeMcpGuide } from "../lib/mcps";
import type { AuthType, McpConfig } from "../lib/types";

interface Props {
  onDone: (config: McpConfig) => void;
}

export function ManualMcpForm({ onDone }: Props) {
  async function handleSubmit(values: {
    name: string;
    command: string;
    args: string;
    envVars: string;
    description: string;
    authType: string;
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

    // parse args: split by newline or space
    const args = values.args
      .trim()
      .split(/[\n]+/)
      .map((a) => a.trim())
      .filter(Boolean);

    // parse env vars: KEY=VALUE per line
    const env: Record<string, string> = {};
    if (values.envVars.trim()) {
      for (const line of values.envVars.trim().split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) {
          env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
      }
    }

    const config: McpConfig = {
      slug,
      name,
      description: values.description.trim() || undefined,
      command,
      args: args.length > 0 ? args : undefined,
      env: Object.keys(env).length > 0 ? env : undefined,
      authType: values.authType as AuthType,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    writeMcpConfig(slug, config);
    writeMcpGuide(
      slug,
      [
        `# ${name} MCP Server`,
        "",
        `Command: \`${command}${args.length > 0 ? " " + args.join(" ") : ""}\``,
        "",
        "## Tools",
        "",
        "No tools documented yet. Use 'Edit with AI' to generate documentation.",
      ].join("\n"),
    );

    await showToast({ style: Toast.Style.Success, title: `${name} added` });
    onDone(config);
  }

  return (
    <Form
      navigationTitle="Add MCP Server Manually"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add MCP Server" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="GitHub MCP"
        autoFocus
      />
      <Form.TextField
        id="command"
        title="Command"
        placeholder="npx"
        info="The command to start the MCP server"
      />
      <Form.TextArea
        id="args"
        title="Arguments"
        placeholder={"@modelcontextprotocol/server-github\n--stdio"}
        info="One argument per line"
      />
      <Form.TextArea
        id="envVars"
        title="Environment Variables"
        placeholder={"GITHUB_TOKEN=ghp_xxx\nANOTHER_VAR=value"}
        info="KEY=VALUE format, one per line"
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="One-line description"
      />
      <Form.Dropdown id="authType" title="Auth Type" defaultValue="none">
        <Form.Dropdown.Item value="none" title="None (env vars handle auth)" />
        <Form.Dropdown.Item value="bearer" title="Bearer Token" />
        <Form.Dropdown.Item value="api-key" title="API Key" />
        <Form.Dropdown.Item value="oauth" title="OAuth 2.0" />
      </Form.Dropdown>
    </Form>
  );
}
