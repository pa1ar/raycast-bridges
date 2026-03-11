import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeSkillMd } from "../lib/skills";

interface Props {
  onDone: (name: string) => void;
}

export function SkillForm({ onDone }: Props) {
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
