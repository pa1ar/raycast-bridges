import {
  Action,
  ActionPanel,
  Form,
  Toast,
  getPreferenceValues,
  showToast,
} from "@raycast/api";
import { useState } from "react";
import { getValidToken } from "../lib/claude-auth-store";
import { scaffoldEdit } from "../lib/scaffold-edit";
import { ScaffoldProgress } from "./ScaffoldProgress";

interface Props {
  slug: string;
  type: "api" | "mcp" | "skill";
  name: string;
  onDone: () => void;
}

export function EditWithAiForm({ slug, type, name, onDone }: Props) {
  const [step, setStep] = useState<"describe" | "running" | "done">("describe");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function appendLog(line: string) {
    setLog((prev) => [...prev.slice(-200), line]);
  }

  async function handleSubmit(values: { description: string }) {
    const description = values.description.trim();
    if (!description) return;

    const prefs = getPreferenceValues<{
      scaffoldingAuth: string;
      anthropicApiKey?: string;
    }>();

    let auth: { apiKey?: string; oauthToken?: string } | null = null;

    if (prefs.scaffoldingAuth === "api-key" && prefs.anthropicApiKey) {
      auth = { apiKey: prefs.anthropicApiKey };
    } else if (prefs.scaffoldingAuth === "oauth") {
      const token = await getValidToken();
      if (token) auth = { oauthToken: token };
    }

    if (!auth) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No auth configured",
        message: "Set up scaffolding auth in extension preferences",
      });
      return;
    }

    setStep("running");
    setLog([]);

    const result = await scaffoldEdit(slug, type, description, auth, appendLog);

    if (result.success) {
      await showToast({
        style: Toast.Style.Success,
        title: `${name} updated`,
      });
      setStep("done");
      onDone();
    } else {
      setError(result.error ?? "Edit failed");
      await showToast({
        style: Toast.Style.Failure,
        title: "Edit failed",
        message: result.error,
      });
      setStep("describe");
    }
  }

  if (step === "running") {
    return (
      <ScaffoldProgress
        title={`Editing ${name}`}
        navigationTitle="Editing with AI..."
        log={log}
      />
    );
  }

  return (
    <Form
      navigationTitle={`Edit ${name} with AI`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Apply Changes" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="description"
        title="Describe changes"
        placeholder="e.g. Add the /users endpoint, fix the auth header format, update the base URL to v2..."
        autoFocus
      />
      {error && <Form.Description title="Error" text={error} />}
    </Form>
  );
}
