import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeCredential } from "../lib/sources";
import type { SourceConfig } from "../lib/types";

interface Props {
  config: SourceConfig;
  onDone: () => void;
  onCancel: () => void;
}

export function CredentialForm({ config, onDone, onCancel }: Props) {
  const isBasic = config.authType === "basic";

  async function handleSubmit(values: {
    credential: string;
    username?: string;
    password?: string;
  }) {
    let value: string;

    if (isBasic) {
      if (!values.username) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Username is required",
        });
        return;
      }
      value = `${values.username}:${values.password ?? ""}`;
    } else {
      if (!values.credential?.trim()) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Credential is required",
        });
        return;
      }
      value = values.credential.trim();
    }

    writeCredential(config.slug, value);
    await showToast({
      style: Toast.Style.Success,
      title: `${config.name} authenticated`,
    });
    onDone();
  }

  const tokenLabel =
    config.authType === "bearer"
      ? "Bearer Token"
      : config.authType === "api-key"
        ? `API Key (${config.apiKeyHeader ?? "X-API-Key"})`
        : "Credential";

  return (
    <Form
      navigationTitle={`Authenticate ${config.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Credential" onSubmit={handleSubmit} />
          <Action title="Skip" onAction={onCancel} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Authentication required"
        text={`${config.name} uses ${config.authType} authentication. Enter your credentials below.`}
      />
      {isBasic ? (
        <>
          <Form.TextField
            id="username"
            title="Username"
            placeholder="your-username"
          />
          <Form.PasswordField
            id="password"
            title="Password"
            placeholder="your-password"
          />
        </>
      ) : (
        <Form.PasswordField
          id="credential"
          title={tokenLabel}
          placeholder="paste your token or API key"
        />
      )}
    </Form>
  );
}
