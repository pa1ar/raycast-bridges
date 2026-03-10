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
import { writeSkillMd } from "./lib/skills";
import { readCredential, writeSourceConfig } from "./lib/sources";
import type { SourceConfig } from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";

type CapabilityType = "api" | "skill";
type Step =
  | "select-type"
  | "describe"
  | "oauth-login"
  | "oauth-code"
  | "scaffolding"
  | "authenticate"
  | "testing"
  | "fix-url"
  | "done"
  | "skill-form"
  | "skill-done";

type TestFailureKind = "auth" | "url" | "unknown";

interface TestResult {
  ok: boolean;
  status: number;
  failureKind?: TestFailureKind;
  message: string;
}

function SkillForm({ onDone }: { onDone: (name: string) => void }) {
  async function handleSubmit(values: {
    name: string;
    description: string;
    instructions: string;
  }) {
    const name = values.name.trim().toLowerCase().replace(/\s+/g, "-");
    const description = values.description.trim();
    const instructions = values.instructions.trim();

    const content = [
      "---",
      `name: ${name}`,
      `description: "${description}"`,
      "---",
      "",
      `# ${name}`,
      "",
      instructions,
    ].join("\n");

    writeSkillMd(name, content);
    await showToast({ style: Toast.Style.Success, title: "Skill saved" });
    onDone(name);
  }

  return (
    <Form
      navigationTitle="Add Skill"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Skill" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="daily-review"
        info="Identifier used to reference this skill (e.g. daily-review)"
        autoFocus
      />
      <Form.TextField
        id="description"
        title="Description"
        placeholder="Review today's notes and tasks"
        info="One-liner shown in list-capabilities output"
      />
      <Form.TextArea
        id="instructions"
        title="Instructions"
        placeholder="Step-by-step instructions for the AI to follow..."
      />
    </Form>
  );
}

export default function AddCapability() {
  const [, setCapabilityType] = useState<CapabilityType>("api");
  const [step, setStep] = useState<Step>("select-type");
  const [scaffoldLog, setScaffoldLog] = useState<string[]>([]);
  const [config, setConfig] = useState<SourceConfig | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSkillName, setSavedSkillName] = useState<string>("");
  const [pendingDescription, setPendingDescription] = useState<string>("");
  const [oauthToken, setOauthToken] = useState<string | null>(null);

  // check for existing OAuth token on mount
  useEffect(() => {
    getValidToken().then((token) => {
      if (token) setOauthToken(token);
    });
  }, []);

  function log(line: string) {
    setScaffoldLog((prev) => [...prev.slice(-200), line]);
  }

  async function handleTypeSubmit(values: { type: string }) {
    const type = values.type as CapabilityType;
    setCapabilityType(type);
    if (type === "skill") {
      setStep("skill-form");
    } else {
      setStep("describe");
    }
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

    // oauth mode
    if (oauthToken) return { oauthToken };
    return null;
  }

  async function handleDescriptionSubmit(values: { description: string }) {
    const prefs = getPreferenceValues<{ scaffoldingAuth: string }>();
    const auth = getAuth();

    if (!auth && prefs.scaffoldingAuth === "oauth") {
      // need to sign in first
      setPendingDescription(values.description);
      setStep("oauth-login");
      return;
    }

    if (!auth) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No API key configured",
        message: "Set your Anthropic API key in extension preferences",
      });
      return;
    }

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

  async function handleAuthDone(cfg: SourceConfig) {
    const credential = readCredential(cfg.slug) ?? "";
    await runTest(cfg, credential);
  }

  async function runTest(cfg: SourceConfig, credential: string) {
    setStep("testing");
    log("Testing connection...");

    const probed = "/";
    const result = await callApi(cfg, credential, {
      path: probed,
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

  if (step === "select-type") {
    return (
      <Form
        navigationTitle="Add Capability"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Continue" onSubmit={handleTypeSubmit} />
          </ActionPanel>
        }
      >
        <Form.Dropdown id="type" title="Type" defaultValue="api">
          <Form.Dropdown.Item value="api" title="API Connection" />
          <Form.Dropdown.Item value="skill" title="Skill" />
        </Form.Dropdown>
      </Form>
    );
  }

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
                  setOauthToken(tokens.accessToken);
                  await showToast({
                    style: Toast.Style.Success,
                    title: "Signed in",
                  });
                  // resume scaffolding with the pending description
                  await runScaffold(pendingDescription, {
                    oauthToken: tokens.accessToken,
                  });
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

  if (step === "scaffolding" || step === "testing") {
    const logOutput = scaffoldLog.join("\n") || "Starting...";
    return (
      <Detail
        markdown={`# ${step === "testing" ? "Testing connection" : "Scaffolding"}\n\n\`\`\`\n${logOutput}\n\`\`\``}
        navigationTitle={
          step === "testing" ? "Testing..." : "Adding Capability..."
        }
      />
    );
  }

  if (step === "authenticate" && config) {
    return (
      <CredentialForm
        config={config}
        onDone={() => handleAuthDone(config)}
        onCancel={() => setStep("done")}
      />
    );
  }

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

  if (step === "done" && config) {
    const ok = testResult?.ok ?? true;
    const isAuthFail = testResult?.failureKind === "auth";
    const isUrlFail = testResult?.failureKind === "url";

    return (
      <Detail
        markdown={[
          `# ${ok ? "✓" : "⚠"} ${config.name}`,
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
