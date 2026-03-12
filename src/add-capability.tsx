import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Toast,
  getPreferenceValues,
  open,
  popToRoot,
  showHUD,
  showToast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { callApi } from "./lib/api-call";
import { getValidToken, saveClaudeTokens } from "./lib/claude-auth-store";
import { exchangeClaudeCode, startClaudeOAuth } from "./lib/claude-oauth";
import { scaffoldSource } from "./lib/scaffold";
import { scaffoldSkill } from "./lib/scaffold-skill";
import { scaffoldMcp } from "./lib/scaffold-mcp";
import { scaffoldCli } from "./lib/scaffold-cli";
import { readCredential, writeSourceConfig } from "./lib/sources";
import type { CliConfig, McpConfig, SourceConfig } from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";
import { ManualApiForm } from "./components/ManualApiForm";
import { ManualMcpForm } from "./components/ManualMcpForm";
import { ManualCliForm } from "./components/ManualCliForm";
import { SkillForm } from "./components/SkillForm";
import { ScaffoldProgress } from "./components/ScaffoldProgress";

type CapabilityType = "api" | "skill" | "mcp" | "cli";
type AddMethod = "ai" | "manual";
type Step =
  | "select-type"
  | "select-method"
  | "describe"
  | "oauth-login"
  | "oauth-code"
  | "scaffolding"
  | "authenticate"
  | "testing"
  | "fix-url"
  | "done"
  | "skill-form"
  | "skill-describe"
  | "skill-done"
  | "manual-api"
  | "manual-mcp"
  | "mcp-describe"
  | "mcp-done"
  | "manual-cli"
  | "cli-describe"
  | "cli-done";

type TestFailureKind = "auth" | "url" | "unknown";

interface TestResult {
  ok: boolean;
  status: number;
  failureKind?: TestFailureKind;
  message: string;
}

export default function AddCapability() {
  const [capabilityType, setCapabilityType] = useState<CapabilityType>("api");
  const [step, setStep] = useState<Step>("select-type");
  const [scaffoldLog, setScaffoldLog] = useState<string[]>([]);
  const [config, setConfig] = useState<SourceConfig | null>(null);
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [cliConfig, setCliConfig] = useState<CliConfig | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSkillName, setSavedSkillName] = useState<string>("");
  const [pendingDescription, setPendingDescription] = useState<string>("");
  const [oauthToken, setOauthToken] = useState<string | null>(null);

  useEffect(() => {
    getValidToken().then((token) => {
      if (token) setOauthToken(token);
    });
  }, []);

  function log(line: string) {
    setScaffoldLog((prev) => [...prev.slice(-200), line]);
  }

  function getAuth(): { apiKey?: string; oauthToken?: string } | null {
    const prefs = getPreferenceValues<{
      scaffoldingAuth: string;
      anthropicApiKey?: string;
    }>();

    if (prefs.scaffoldingAuth === "api-key") {
      if (prefs.anthropicApiKey) return { apiKey: prefs.anthropicApiKey };
      return null;
    }

    if (oauthToken) return { oauthToken };
    return null;
  }

  async function ensureAuth(
    description: string,
  ): Promise<{ apiKey?: string; oauthToken?: string } | null> {
    const prefs = getPreferenceValues<{ scaffoldingAuth: string }>();
    const auth = getAuth();

    if (!auth && prefs.scaffoldingAuth === "oauth") {
      setPendingDescription(description);
      setStep("oauth-login");
      return null;
    }

    if (!auth) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No API key configured",
        message: "Set your Anthropic API key in extension preferences",
      });
      return null;
    }

    return auth;
  }

  // --- API scaffolding ---

  async function handleDescriptionSubmit(values: { description: string }) {
    const auth = await ensureAuth(values.description);
    if (!auth) return;
    await runScaffold(values.description, auth);
  }

  async function runScaffold(
    description: string,
    auth: { apiKey?: string; oauthToken?: string },
  ) {
    setStep("scaffolding");
    setScaffoldLog([]);

    const result = await scaffoldSource(description, auth, log);

    if (!result.success || !result.config) {
      setError(result.error ?? "Scaffolding failed");
      setStep("describe");
      await showToast({
        style: Toast.Style.Failure,
        title: "Scaffolding failed",
        message: result.error,
      });
      return;
    }

    setConfig(result.config);

    if (result.config.authType === "none") {
      await runTest(result.config, "");
    } else {
      setStep("authenticate");
    }
  }

  // --- Skill scaffolding ---

  async function handleSkillDescribeSubmit(values: { description: string }) {
    const auth = await ensureAuth(values.description);
    if (!auth) return;
    await runSkillScaffold(values.description, auth);
  }

  async function runSkillScaffold(
    description: string,
    auth: { apiKey?: string; oauthToken?: string },
  ) {
    setStep("scaffolding");
    setScaffoldLog([]);

    const result = await scaffoldSkill(description, auth, log);

    if (!result.success || !result.name) {
      setError(result.error ?? "Scaffolding failed");
      setStep("skill-describe");
      await showToast({
        style: Toast.Style.Failure,
        title: "Scaffolding failed",
        message: result.error,
      });
      return;
    }

    setSavedSkillName(result.name);
    setStep("skill-done");
  }

  // --- MCP scaffolding ---

  async function handleMcpDescribeSubmit(values: { description: string }) {
    const auth = await ensureAuth(values.description);
    if (!auth) return;
    await runMcpScaffold(values.description, auth);
  }

  async function runMcpScaffold(
    description: string,
    auth: { apiKey?: string; oauthToken?: string },
  ) {
    setStep("scaffolding");
    setScaffoldLog([]);

    const result = await scaffoldMcp(description, auth, log);

    if (!result.success || !result.config) {
      setError(result.error ?? "Scaffolding failed");
      setStep("mcp-describe");
      await showToast({
        style: Toast.Style.Failure,
        title: "Scaffolding failed",
        message: result.error,
      });
      return;
    }

    setMcpConfig(result.config);
    setStep("mcp-done");
  }

  // --- CLI scaffolding ---

  async function handleCliDescribeSubmit(values: { description: string }) {
    const auth = await ensureAuth(values.description);
    if (!auth) return;
    await runCliScaffold(values.description, auth);
  }

  async function runCliScaffold(
    description: string,
    auth: { apiKey?: string; oauthToken?: string },
  ) {
    setStep("scaffolding");
    setScaffoldLog([]);

    const result = await scaffoldCli(description, auth, log);

    if (!result.success || !result.config) {
      setError(result.error ?? "Scaffolding failed");
      setStep("cli-describe");
      await showToast({
        style: Toast.Style.Failure,
        title: "Scaffolding failed",
        message: result.error,
      });
      return;
    }

    setCliConfig(result.config);
    setStep("cli-done");
  }

  // --- Testing ---

  async function handleAuthDone(cfg: SourceConfig) {
    const credential = readCredential(cfg.slug) ?? "";
    await runTest(cfg, credential);
  }

  async function runTest(cfg: SourceConfig, credential: string) {
    setStep("testing");
    log("Testing connection...");

    const result = await callApi(cfg, credential, {
      path: "/",
      method: "GET",
    });

    let tr: TestResult;

    if (result.error) {
      tr = {
        ok: false,
        status: 0,
        failureKind: "url",
        message: `Could not reach ${cfg.baseUrl} — ${result.error}`,
      };
    } else if (result.status === 401 || result.status === 403) {
      tr = {
        ok: false,
        status: result.status,
        failureKind: "auth",
        message: `Authentication failed (HTTP ${result.status}) — credentials rejected`,
      };
    } else {
      tr = {
        ok: true,
        status: result.status,
        message: `Connected to ${cfg.baseUrl}`,
      };
    }

    setTestResult(tr);
    setStep("done");
  }

  async function handleUrlFix(values: { baseUrl: string }) {
    if (!config) return;
    const updated: SourceConfig = {
      ...config,
      baseUrl: values.baseUrl.trim().replace(/\/$/, ""),
      updatedAt: Date.now(),
    };
    writeSourceConfig(config.slug, updated);
    setConfig(updated);
    const credential = readCredential(updated.slug) ?? "";
    await runTest(updated, credential);
  }

  // --- OAuth flow (for scaffolding auth) ---

  async function handleOAuthResume(token: string) {
    setOauthToken(token);
    const auth = { oauthToken: token };

    if (capabilityType === "api") {
      await runScaffold(pendingDescription, auth);
    } else if (capabilityType === "skill") {
      await runSkillScaffold(pendingDescription, auth);
    } else if (capabilityType === "mcp") {
      await runMcpScaffold(pendingDescription, auth);
    } else if (capabilityType === "cli") {
      await runCliScaffold(pendingDescription, auth);
    }
  }

  // === RENDER ===

  if (step === "select-type") {
    return (
      <Form
        navigationTitle="Add Capability"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Continue"
              onSubmit={(values: { type: string }) => {
                const type = values.type as CapabilityType;
                setCapabilityType(type);
                setStep("select-method");
              }}
            />
          </ActionPanel>
        }
      >
        <Form.Dropdown id="type" title="Type" defaultValue="api">
          <Form.Dropdown.Item value="api" title="API Connection" />
          <Form.Dropdown.Item value="mcp" title="MCP Server" />
          <Form.Dropdown.Item value="cli" title="CLI Tool" />
          <Form.Dropdown.Item value="skill" title="Skill" />
        </Form.Dropdown>
      </Form>
    );
  }

  if (step === "select-method") {
    return (
      <Form
        navigationTitle="Add Capability"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Continue"
              onSubmit={(values: { method: string }) => {
                const method = values.method as AddMethod;
                if (capabilityType === "api") {
                  setStep(method === "ai" ? "describe" : "manual-api");
                } else if (capabilityType === "mcp") {
                  setStep(method === "ai" ? "mcp-describe" : "manual-mcp");
                } else if (capabilityType === "cli") {
                  setStep(method === "ai" ? "cli-describe" : "manual-cli");
                } else {
                  setStep(method === "ai" ? "skill-describe" : "skill-form");
                }
              }}
            />
          </ActionPanel>
        }
      >
        <Form.Dropdown id="method" title="Method" defaultValue="ai">
          <Form.Dropdown.Item value="ai" title="Scaffold with AI" />
          <Form.Dropdown.Item value="manual" title="Add Manually" />
        </Form.Dropdown>
      </Form>
    );
  }

  // --- Manual forms ---

  if (step === "manual-api") {
    return (
      <ManualApiForm
        onDone={(cfg) => {
          setConfig(cfg);
          if (cfg.authType === "none") {
            runTest(cfg, "");
          } else {
            setStep("authenticate");
          }
        }}
      />
    );
  }

  if (step === "manual-mcp") {
    return (
      <ManualMcpForm
        onDone={(cfg) => {
          setMcpConfig(cfg);
          setStep("mcp-done");
        }}
      />
    );
  }

  if (step === "manual-cli") {
    return (
      <ManualCliForm
        onDone={(cfg) => {
          setCliConfig(cfg);
          setStep("cli-done");
        }}
      />
    );
  }

  // --- Skill forms ---

  if (step === "skill-form") {
    return (
      <SkillForm
        onDone={(name) => {
          setSavedSkillName(name);
          setStep("skill-done");
        }}
      />
    );
  }

  if (step === "skill-describe") {
    return (
      <Form
        navigationTitle="Scaffold Skill with AI"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Scaffold Skill"
              onSubmit={handleSkillDescribeSubmit}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea
          id="description"
          title="Describe the skill"
          placeholder={
            "e.g. A skill that reviews my daily Craft notes and summarizes action items.\n\n" +
            "The AI agent will create step-by-step instructions referencing your installed capabilities."
          }
          autoFocus
        />
        {error && <Form.Description title="Error" text={error} />}
      </Form>
    );
  }

  if (step === "skill-done") {
    return (
      <Detail
        markdown={[
          `# Skill saved: ${savedSkillName}`,
          "",
          "Ask Raycast AI to use this skill — it will appear in `list-capabilities` output.",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action
              title="Done"
              onAction={async () => {
                await showHUD(`Skill '${savedSkillName}' ready`);
                await popToRoot();
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  // --- MCP describe ---

  if (step === "mcp-describe") {
    return (
      <Form
        navigationTitle="Scaffold MCP Server with AI"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Scaffold MCP"
              onSubmit={handleMcpDescribeSubmit}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea
          id="description"
          title="Describe the MCP server"
          placeholder={
            "e.g. Add the GitHub MCP server for managing repos, issues, and PRs\n\n" +
            "The AI agent will research the server and create its configuration."
          }
          autoFocus
        />
        {error && <Form.Description title="Error" text={error} />}
      </Form>
    );
  }

  if (step === "mcp-done") {
    const cfg = mcpConfig;
    return (
      <Detail
        markdown={[
          `# ${cfg ? "MCP Server added" : "Done"}`,
          "",
          cfg ? `**Name:** ${cfg.name}` : "",
          cfg
            ? `**Command:** \`${cfg.command}${cfg.args ? " " + cfg.args.join(" ") : ""}\``
            : "",
          cfg?.description ? `**Description:** ${cfg.description}` : "",
          "",
          "The MCP server guide is available via `get-capability-guide`.",
          "MCP servers are callable through `call-capability` using pseudo-paths like `GET /tools` and `POST /tools/<tool>/call`.",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action
              title="Done"
              onAction={async () => {
                await showHUD(cfg ? `${cfg.name} ready` : "MCP server added");
                await popToRoot();
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  // --- CLI describe ---

  if (step === "cli-describe") {
    return (
      <Form
        navigationTitle="Scaffold CLI Tool with AI"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Scaffold CLI"
              onSubmit={handleCliDescribeSubmit}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea
          id="description"
          title="Describe the CLI tool"
          placeholder={
            "e.g. GitHub CLI (gh) for managing repos, PRs, and issues from the command line\n\n" +
            "The AI agent will check installation, research docs, and create a guide."
          }
          autoFocus
        />
        {error && <Form.Description title="Error" text={error} />}
      </Form>
    );
  }

  if (step === "cli-done") {
    const cfg = cliConfig;
    return (
      <Detail
        markdown={[
          `# ${cfg ? "CLI Tool added" : "Done"}`,
          "",
          cfg ? `**Name:** ${cfg.name}` : "",
          cfg ? `**Command:** \`${cfg.command}\`` : "",
          cfg?.description ? `**Description:** ${cfg.description}` : "",
          "",
          "The CLI guide is available via `get-capability-guide`.",
          "CLI tools are callable through `call-capability` with the subcommand and flags as the path field.",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action
              title="Done"
              onAction={async () => {
                await showHUD(cfg ? `${cfg.name} ready` : "CLI tool added");
                await popToRoot();
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  // --- OAuth flow ---

  if (step === "oauth-login") {
    return (
      <Detail
        navigationTitle="Sign in with Claude"
        markdown={[
          "# Sign in with Claude",
          "",
          "Sign in with your Claude account to scaffold capabilities.",
          "",
          "1. Click **Sign in with Claude** below",
          "2. Authenticate in your browser",
          "3. Copy the authorization code from the callback page",
          "4. Paste it in the next step",
        ].join("\n")}
        actions={
          <ActionPanel>
            <Action
              title="Sign in with Claude"
              onAction={async () => {
                const authUrl = startClaudeOAuth();
                await open(authUrl);
                setStep("oauth-code");
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  if (step === "oauth-code") {
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
                    title: "Signed in",
                  });
                  await handleOAuthResume(tokens.accessToken);
                } catch (err) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "OAuth failed",
                    message: err instanceof Error ? err.message : String(err),
                  });
                  setStep("oauth-login");
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

  // --- API describe (AI scaffold) ---

  if (step === "describe") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Add Capability"
              onSubmit={handleDescriptionSubmit}
            />
          </ActionPanel>
        }
      >
        <Form.TextArea
          id="description"
          title="Describe the capability"
          placeholder={
            "e.g. Add Craft API — base URL is https://connect.craft.do/links/XXX/api/v1, uses bearer token auth\n\n" +
            "Do not include API keys or tokens here — you will be asked to enter them securely in the next step."
          }
          autoFocus
        />
        {error && <Form.Description title="Error" text={error} />}
      </Form>
    );
  }

  // --- Scaffolding / Testing progress ---

  if (step === "scaffolding" || step === "testing") {
    return (
      <ScaffoldProgress
        title={step === "testing" ? "Testing connection" : "Scaffolding"}
        navigationTitle={
          step === "testing" ? "Testing..." : "Adding Capability..."
        }
        log={scaffoldLog}
      />
    );
  }

  // --- Authenticate ---

  if (step === "authenticate" && config) {
    return (
      <CredentialForm
        config={config}
        onDone={() => handleAuthDone(config)}
        onCancel={() => setStep("done")}
      />
    );
  }

  // --- Fix URL ---

  if (step === "fix-url" && config) {
    return (
      <Form
        navigationTitle="Fix Base URL"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Retry" onSubmit={handleUrlFix} />
          </ActionPanel>
        }
      >
        <Form.Description
          title="Connection failed"
          text={
            testResult?.message ??
            "Could not reach the API. Check the base URL below."
          }
        />
        <Form.TextField
          id="baseUrl"
          title="Base URL"
          defaultValue={config.baseUrl}
          placeholder="https://api.example.com/v1"
        />
      </Form>
    );
  }

  // --- Done ---

  if (step === "done" && config) {
    const ok = testResult?.ok ?? true;
    const isAuthFail = testResult?.failureKind === "auth";
    const isUrlFail = testResult?.failureKind === "url";

    return (
      <Detail
        markdown={[
          `# ${ok ? "Done" : "Warning"} — ${config.name}`,
          "",
          `**Base URL:** ${config.baseUrl}`,
          `**Auth:** ${config.authType}${config.apiKeyHeader ? ` (${config.apiKeyHeader})` : ""}`,
          "",
          testResult ? `**Connection test:** ${testResult.message}` : "",
          "",
          ok
            ? "Ready. Ask Raycast AI to use this capability."
            : isAuthFail
              ? "Capability saved. Fix your credentials and retry."
              : isUrlFail
                ? "Capability saved. The base URL may be wrong — edit it below."
                : "Capability saved but connection test failed.",
        ].join("\n")}
        actions={
          <ActionPanel>
            {isAuthFail && (
              <Action
                title="Re-Enter Credentials"
                onAction={() => setStep("authenticate")}
              />
            )}
            {isUrlFail && (
              <Action
                title="Fix Base URL"
                onAction={() => setStep("fix-url")}
              />
            )}
            <Action
              title="Done"
              onAction={async () => {
                await showHUD(
                  `${config.name} ready — ask Raycast AI to use it`,
                );
                await popToRoot();
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  return null;
}
