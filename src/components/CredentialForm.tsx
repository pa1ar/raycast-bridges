import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeCredential } from "../lib/sources";
import type { AuthType, SourceConfig } from "../lib/types";

interface BaseProps {
  name: string;
  authType: AuthType;
  apiKeyHeader?: string;
  onDone: () => void;
  onCancel: () => void;
  writeCredentialFn: (value: string) => void;
}

interface SourceProps {
  config: SourceConfig;
  onDone: () => void;
  onCancel: () => void;
}

// overloaded: pass config (source) or explicit fields (mcp)
type Props = SourceProps | BaseProps;

function isSourceProps(props: Props): props is SourceProps {
  return "config" in props;
}

export function CredentialForm(props: Props) {
  const name = isSourceProps(props) ? props.config.name : props.name;
  const authType = isSourceProps(props)
    ? props.config.authType
    : props.authType;
  const apiKeyHeader = isSourceProps(props)
    ? props.config.apiKeyHeader
    : props.apiKeyHeader;
  const writeFn = isSourceProps(props)
    ? (value: string) => writeCredential(props.config.slug, value)
    : props.writeCredentialFn;

  const isBasic = authType === "basic";

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

    writeFn(value);
    await showToast({
      style: Toast.Style.Success,
      title: `${name} authenticated`,
    });
    props.onDone();
  }

  const tokenLabel =
    authType === "bearer" || authType === "oauth"
      ? "Bearer Token"
      : authType === "api-key"
        ? `API Key (${apiKeyHeader ?? "X-API-Key"})`
        : "Credential";

  return (
    <Form
      navigationTitle={`Authenticate ${name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Credential" onSubmit={handleSubmit} />
          <Action title="Skip" onAction={props.onCancel} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Authentication required"
        text={`${name} uses ${authType} authentication. Enter your credentials below.`}
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
