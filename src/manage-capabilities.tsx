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
  getPreferenceValues,
  open,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  clearClaudeTokens,
  loadClaudeTokens,
  saveClaudeTokens,
} from "./lib/claude-auth-store";
import { exchangeClaudeCode, startClaudeOAuth } from "./lib/claude-oauth";
import {
  deleteSource,
  loadAllSources,
  readSourceConfig,
  writeSourceConfig,
} from "./lib/sources";
import { deleteSkill, loadAllSkills, writeSkillMd } from "./lib/skills";
import type {
  AuthType,
  LoadedSource,
  SkillInfo,
  SourceConfig,
} from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";

function EditSourceForm({
  config,
  onDone,
}: {
  config: SourceConfig;
  onDone: () => void;
}) {
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

function EditSkillForm({
  skill,
  onDone,
}: {
  skill: SkillInfo;
  onDone: () => void;
}) {
  // extract body (everything after the closing ---)
  const bodyMatch = skill.content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  const defaultInstructions = bodyMatch?.[1]?.trim() ?? skill.content;

  async function handleSubmit(values: {
    description: string;
    instructions: string;
  }) {
    const description = values.description.trim();
    const instructions = values.instructions.trim();

    const content = [
      "---",
      `name: ${skill.name}`,
      `description: "${description}"`,
      "---",
      "",
      `# ${skill.name}`,
      "",
      instructions,
    ].join("\n");

    writeSkillMd(skill.name, content);
    await showToast({ style: Toast.Style.Success, title: "Saved" });
    onDone();
  }

  return (
    <Form
      navigationTitle={`Edit skill: ${skill.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="description"
        title="Description"
        placeholder="What this skill does"
        defaultValue={skill.description}
      />
      <Form.TextArea
        id="instructions"
        title="Instructions"
        placeholder="Step-by-step instructions for the AI..."
        defaultValue={defaultInstructions}
      />
    </Form>
  );
}

function OAuthCodeForm({ onDone }: { onDone: () => void }) {
  return (
    <Form
      navigationTitle="Paste Authorization Code"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Submit Code"
            onSubmit={async (values: { code: string }) => {
              const code = values.code.trim();
              if (!code) return;
              try {
                await showToast({
                  style: Toast.Style.Animated,
                  title: "Exchanging code...",
                });
                const tokens = await exchangeClaudeCode(code);
                await saveClaudeTokens(tokens);
                await showToast({
                  style: Toast.Style.Success,
                  title: "Signed in with Claude",
                });
                onDone();
              } catch (err) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "OAuth failed",
                  message: err instanceof Error ? err.message : String(err),
                });
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="code"
        title="Authorization Code"
        placeholder="Paste the code from your browser"
        autoFocus
      />
    </Form>
  );
}

export default function ManageCapabilities() {
  const [sources, setSources] = useState<LoadedSource[]>(() =>
    loadAllSources(false),
  );
  const [skills, setSkills] = useState<SkillInfo[]>(() => loadAllSkills());
  const [hasOAuth, setHasOAuth] = useState(false);
  const { push } = useNavigation();

  const prefs = getPreferenceValues<{
    scaffoldingAuth: string;
    anthropicApiKey?: string;
  }>();

  useEffect(() => {
    loadClaudeTokens().then((t) => setHasOAuth(t !== null));
  }, []);

  function refreshAll() {
    setSources(loadAllSources(false));
    setSkills(loadAllSkills());
    loadClaudeTokens().then((t) => setHasOAuth(t !== null));
  }

  function refresh() {
    setSources(loadAllSources(false));
    setSkills(loadAllSkills());
  }

  async function handleDeleteSource(slug: string, name: string) {
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

  async function handleDeleteSkill(name: string) {
    const confirmed = await confirmAlert({
      title: `Remove skill '${name}'?`,
      message: "This will permanently delete the skill.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    deleteSkill(name);
    await showToast({
      style: Toast.Style.Success,
      title: `Skill '${name}' removed`,
    });
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

  return (
    <List>
      {sources.length > 0 && (
        <List.Section title="API Sources">
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
                    onAction={() =>
                      push(
                        <EditSourceForm
                          config={source.config}
                          onDone={refresh}
                        />,
                      )
                    }
                  />
                  <Action
                    icon={Icon.Key}
                    title="Set Credentials"
                    onAction={() =>
                      push(
                        <CredentialForm
                          config={source.config}
                          onDone={refresh}
                          onCancel={refresh}
                        />,
                      )
                    }
                  />
                  <Action
                    icon={
                      source.config.enabled ? Icon.CircleDisabled : Icon.Circle
                    }
                    title={source.config.enabled ? "Disable" : "Enable"}
                    onAction={() => handleToggle(source)}
                  />
                  <Action
                    icon={Icon.Trash}
                    title="Remove"
                    style={Action.Style.Destructive}
                    onAction={() =>
                      handleDeleteSource(source.config.slug, source.config.name)
                    }
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {skills.length > 0 && (
        <List.Section title="Skills">
          {skills.map((skill) => (
            <List.Item
              key={skill.name}
              icon={Icon.Document}
              title={skill.name}
              subtitle={skill.description}
              actions={
                <ActionPanel>
                  <Action
                    icon={Icon.Pencil}
                    title="Edit"
                    onAction={() =>
                      push(<EditSkillForm skill={skill} onDone={refresh} />)
                    }
                  />
                  <Action
                    icon={Icon.Trash}
                    title="Remove"
                    style={Action.Style.Destructive}
                    onAction={() => handleDeleteSkill(skill.name)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      <List.Section title="Scaffolding Auth">
        {prefs.scaffoldingAuth === "oauth" ? (
          <List.Item
            icon={hasOAuth ? Icon.PersonCircle : Icon.Person}
            title="Claude Subscription (OAuth)"
            subtitle={hasOAuth ? "Signed in" : "Not signed in"}
            accessories={
              hasOAuth
                ? [{ tag: { value: "active", color: Color.Green } }]
                : [{ tag: { value: "sign in required", color: Color.Orange } }]
            }
            actions={
              <ActionPanel>
                {hasOAuth ? (
                  <Action
                    icon={Icon.XMarkCircle}
                    title="Sign Out Of Claude"
                    style={Action.Style.Destructive}
                    onAction={async () => {
                      await clearClaudeTokens();
                      setHasOAuth(false);
                      await showToast({
                        style: Toast.Style.Success,
                        title: "Signed out of Claude",
                      });
                    }}
                  />
                ) : (
                  <Action
                    icon={Icon.PersonCircle}
                    title="Sign In With Claude"
                    onAction={async () => {
                      const authUrl = startClaudeOAuth();
                      await open(authUrl);
                      push(<OAuthCodeForm onDone={refreshAll} />);
                    }}
                  />
                )}
              </ActionPanel>
            }
          />
        ) : (
          <List.Item
            icon={Icon.Key}
            title="Anthropic API Key"
            subtitle={prefs.anthropicApiKey ? "Configured" : "Not set"}
            accessories={
              prefs.anthropicApiKey
                ? [{ tag: { value: "active", color: Color.Green } }]
                : [
                    {
                      tag: {
                        value: "set in preferences",
                        color: Color.Orange,
                      },
                    },
                  ]
            }
          />
        )}
      </List.Section>
    </List>
  );
}
