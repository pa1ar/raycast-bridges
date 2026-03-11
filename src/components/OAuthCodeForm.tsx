import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { saveClaudeTokens } from "../lib/claude-auth-store";
import { exchangeClaudeCode } from "../lib/claude-oauth";

interface Props {
  onDone: () => void;
}

export function OAuthCodeForm({ onDone }: Props) {
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
