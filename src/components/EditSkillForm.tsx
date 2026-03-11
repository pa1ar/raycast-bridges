import { Action, ActionPanel, Form, Toast, showToast } from "@raycast/api";
import { writeSkillMd } from "../lib/skills";
import type { SkillInfo } from "../lib/types";

interface Props {
  skill: SkillInfo;
  onDone: () => void;
}

export function EditSkillForm({ skill, onDone }: Props) {
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
