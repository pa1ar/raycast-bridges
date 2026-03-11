import { Detail } from "@raycast/api";

interface Props {
  title: string;
  navigationTitle: string;
  log: string[];
}

export function ScaffoldProgress({ title, navigationTitle, log }: Props) {
  const logOutput = log.join("\n") || "Starting...";
  return (
    <Detail
      markdown={`# ${title}\n\n\`\`\`\n${logOutput}\n\`\`\``}
      navigationTitle={navigationTitle}
    />
  );
}
