import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Toast,
  getPreferenceValues,
  popToRoot,
  showHUD,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useState } from "react";
import { callApi } from "./lib/api-call";
import { scaffoldSource } from "./lib/scaffold";
import { readCredential, readSourceConfig, writeSourceConfig } from "./lib/sources";
import type { SourceConfig } from "./lib/types";
import { CredentialForm } from "./components/CredentialForm";

type Step = "describe" | "scaffolding" | "authenticate" | "testing" | "fix-url" | "done";

type TestFailureKind = "auth" | "url" | "unknown";

interface TestResult {
  ok: boolean;
  status: number;
  failureKind?: TestFailureKind;
  message: string;
}

export default function AddCapability() {
  const [step, setStep] = useState<Step>("describe");
  const [scaffoldLog, setScaffoldLog] = useState<string[]>([]);
  const [config, setConfig] = useState<SourceConfig | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { push } = useNavigation();

  function log(line: string) {
    setScaffoldLog((prev) => [...prev.slice(-200), line]);
  }

  async function handleDescriptionSubmit(values: { description: string }) {
    setStep("scaffolding");
    setScaffoldLog([]);

    const { anthropicApiKey } = getPreferenceValues<{ anthropicApiKey: string }>();
    const result = await scaffoldSource(values.description, anthropicApiKey, log);

    if (!result.success || !result.config) {
      setError(result.error ?? "Scaffolding failed");
      setStep("describe");
      await showToast({ style: Toast.Style.Failure, title: "Scaffolding failed", message: result.error });
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

    // probe several paths — stop at the first server response (any HTTP status)
    // a network error means the URL is wrong; any HTTP response means we're reaching the server
    const probePaths = ["/documents", "/folders", "/items", "/"];
    let result = await callApi(cfg, credential, { path: probePaths[0], method: "GET" });
    let probed = probePaths[0];

    for (let i = 1; i < probePaths.length; i++) {
      if (!result.error) break; // got a server response — done
      result = await callApi(cfg, credential, { path: probePaths[i], method: "GET" });
      probed = probePaths[i];
    }

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
      // any other HTTP status (200, 404, 405…) = server is up and responding
      tr = {
        ok: true,
        status: result.status,
        message: `Server reachable — ${cfg.baseUrl}${probed} returned HTTP ${result.status}`,
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

  if (step === "describe") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Add Capability" onSubmit={handleDescriptionSubmit} />
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
    const log = scaffoldLog.join("\n") || "Starting...";
    return (
      <Detail
        markdown={`# ${step === "testing" ? "Testing connection" : "Scaffolding"}\n\n\`\`\`\n${log}\n\`\`\``}
        navigationTitle={step === "testing" ? "Testing..." : "Adding Capability..."}
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
          text={testResult?.message ?? "Could not reach the API. Check the base URL below."}
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
                title="Re-enter Credentials"
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
                await showHUD(`${config.name} ready — ask Raycast AI to use it`);
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
