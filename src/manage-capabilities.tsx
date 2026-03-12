import {
  Action,
  ActionPanel,
  Alert,
  Color,
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
import { clearClaudeTokens, loadClaudeTokens } from "./lib/claude-auth-store";
import { startClaudeOAuth } from "./lib/claude-oauth";
import {
  deleteCredential,
  deleteSource,
  loadAllSources,
  readSourceConfig,
  writeSourceConfig,
} from "./lib/sources";
import {
  deleteMcp,
  deleteMcpCredential,
  loadAllMcps,
  readMcpConfig,
  writeMcpConfig,
  writeMcpCredential,
} from "./lib/mcps";
import { deleteSkill, loadAllSkills } from "./lib/skills";
import type { LoadedMcp, LoadedSource, SkillInfo } from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";
import { EditSourceForm } from "./components/EditSourceForm";
import { EditSkillForm } from "./components/EditSkillForm";
import { EditMcpForm } from "./components/EditMcpForm";
import { EditWithAiForm } from "./components/EditWithAiForm";
import { OAuthCodeForm } from "./components/OAuthCodeForm";
import { authorizeRemoteMcp, callMcp } from "./lib/mcp-client";

export default function ManageCapabilities() {
  const [sources, setSources] = useState<LoadedSource[]>(() =>
    loadAllSources(false),
  );
  const [mcps, setMcps] = useState<LoadedMcp[]>(() => loadAllMcps(false));
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
    setMcps(loadAllMcps(false));
    setSkills(loadAllSkills());
    loadClaudeTokens().then((t) => setHasOAuth(t !== null));
  }

  function refresh() {
    setSources(loadAllSources(false));
    setMcps(loadAllMcps(false));
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

  async function handleDeleteMcp(slug: string, name: string) {
    const confirmed = await confirmAlert({
      title: `Remove ${name}?`,
      message: "This will delete the MCP server configuration.",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    deleteMcp(slug);
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

  async function handleToggleSource(source: LoadedSource) {
    const config = readSourceConfig(source.config.slug);
    if (!config) return;
    config.enabled = !config.enabled;
    config.updatedAt = Date.now();
    writeSourceConfig(source.config.slug, config);
    refresh();
  }

  async function handleToggleMcp(mcp: LoadedMcp) {
    const config = readMcpConfig(mcp.config.slug);
    if (!config) return;
    config.enabled = !config.enabled;
    config.updatedAt = Date.now();
    writeMcpConfig(mcp.config.slug, config);
    refresh();
  }

  async function handleReconnectSource(slug: string, name: string) {
    deleteCredential(slug);
    await showToast({
      style: Toast.Style.Success,
      title: `Credentials cleared for ${name}`,
    });
    const config = readSourceConfig(slug);
    if (config) {
      push(
        <CredentialForm config={config} onDone={refresh} onCancel={refresh} />,
      );
    } else {
      refresh();
    }
  }

  async function handleReconnectMcp(slug: string, name: string) {
    deleteMcpCredential(slug);
    await showToast({
      style: Toast.Style.Success,
      title: `Credentials cleared for ${name}`,
    });
    refresh();
  }

  async function handleAuthorizeMcp(mcp: LoadedMcp) {
    const config = readMcpConfig(mcp.config.slug);
    if (!config) return;

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Starting OAuth for ${config.name}`,
      message: "Finish the browser flow if one opens",
    });

    try {
      if (config.url) {
        const tokens = await authorizeRemoteMcp(config, {
          openAuthorizationUrl: open,
          timeoutMs: 180_000,
        });
        writeMcpCredential(config.slug, tokens.accessToken, tokens.expiresAt);
      } else {
        await callMcp(
          config,
          {
            path: "/ping",
            method: "GET",
          },
          {
            timeoutMs: 180_000,
          },
        );
        writeMcpCredential(config.slug, "oauth-connected");
      }
      toast.style = Toast.Style.Success;
      toast.title = `${config.name} connected`;
      toast.message = "MCP handshake succeeded";
      refresh();
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `OAuth failed for ${config.name}`;
      toast.message = error instanceof Error ? error.message : String(error);
    }
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
                    icon={Icon.Wand}
                    title="Edit with AI"
                    onAction={() =>
                      push(
                        <EditWithAiForm
                          slug={source.config.slug}
                          type="api"
                          name={source.config.name}
                          onDone={refresh}
                        />,
                      )
                    }
                  />
                  {source.config.authType !== "none" && (
                    <Action
                      icon={Icon.ArrowClockwise}
                      title="Reconnect"
                      onAction={() =>
                        handleReconnectSource(
                          source.config.slug,
                          source.config.name,
                        )
                      }
                    />
                  )}
                  <Action
                    icon={
                      source.config.enabled ? Icon.CircleDisabled : Icon.Circle
                    }
                    title={source.config.enabled ? "Disable" : "Enable"}
                    onAction={() => handleToggleSource(source)}
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

      {mcps.length > 0 && (
        <List.Section title="MCP Servers">
          {mcps.map((mcp) => (
            <List.Item
              key={mcp.config.slug}
              icon={mcp.config.enabled ? Icon.Terminal : Icon.CircleDisabled}
              title={mcp.config.name}
              subtitle={
                mcp.config.url
                  ? mcp.config.url
                  : `${mcp.config.command}${mcp.config.args ? " " + mcp.config.args[0] : ""}`
              }
              accessories={[
                mcp.isAuthenticated
                  ? { tag: { value: "ready", color: Color.Green } }
                  : { tag: { value: "needs setup", color: Color.Orange } },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    icon={Icon.Pencil}
                    title="Edit"
                    onAction={() =>
                      push(<EditMcpForm config={mcp.config} onDone={refresh} />)
                    }
                  />
                  {mcp.config.authType === "oauth" && (
                    <Action
                      icon={Icon.PersonCircle}
                      title={
                        mcp.isAuthenticated ? "Reconnect OAuth" : "Start OAuth"
                      }
                      onAction={() => handleAuthorizeMcp(mcp)}
                    />
                  )}
                  {mcp.config.authType !== "none" &&
                    mcp.config.authType !== "oauth" && (
                      <Action
                        icon={Icon.Key}
                        title="Set Credentials"
                        onAction={() =>
                          push(
                            <CredentialForm
                              name={mcp.config.name}
                              authType={mcp.config.authType}
                              onDone={refresh}
                              onCancel={refresh}
                              writeCredentialFn={(value) =>
                                writeMcpCredential(mcp.config.slug, value)
                              }
                            />,
                          )
                        }
                      />
                    )}
                  <Action
                    icon={Icon.Wand}
                    title="Edit with AI"
                    onAction={() =>
                      push(
                        <EditWithAiForm
                          slug={mcp.config.slug}
                          type="mcp"
                          name={mcp.config.name}
                          onDone={refresh}
                        />,
                      )
                    }
                  />
                  {mcp.config.authType !== "none" &&
                    mcp.config.authType !== "oauth" && (
                      <Action
                        icon={Icon.ArrowClockwise}
                        title="Reconnect"
                        onAction={() =>
                          handleReconnectMcp(mcp.config.slug, mcp.config.name)
                        }
                      />
                    )}
                  <Action
                    icon={
                      mcp.config.enabled ? Icon.CircleDisabled : Icon.Circle
                    }
                    title={mcp.config.enabled ? "Disable" : "Enable"}
                    onAction={() => handleToggleMcp(mcp)}
                  />
                  <Action
                    icon={Icon.Trash}
                    title="Remove"
                    style={Action.Style.Destructive}
                    onAction={() =>
                      handleDeleteMcp(mcp.config.slug, mcp.config.name)
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
                    icon={Icon.Wand}
                    title="Edit with AI"
                    onAction={() =>
                      push(
                        <EditWithAiForm
                          slug={skill.name}
                          type="skill"
                          name={skill.name}
                          onDone={refresh}
                        />,
                      )
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
                    title="Sign out of Claude"
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
                    title="Sign in with Claude"
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
