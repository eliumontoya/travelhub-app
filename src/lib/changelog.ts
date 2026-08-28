import { readFileSync } from "fs";
import { join } from "path";

export type ChangelogEntry = {
  date: string;
  title: string;
  description: string;
};

const changelogPath = join(process.cwd(), "Changes.md");
const entryHeadingPattern = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+(.+)$/;

export function parseChangelogMarkdown(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(entryHeadingPattern);

    if (heading) {
      if (current) {
        entries.push(normalizeEntry(current));
      }

      current = {
        date: heading[1],
        title: heading[2].trim(),
        description: "",
      };
      continue;
    }

    if (!current) {
      continue;
    }

    current.description = [current.description, line.trim()].filter(Boolean).join(" ");
  }

  if (current) {
    entries.push(normalizeEntry(current));
  }

  return entries;
}

export function getChangelog(): ChangelogEntry[] {
  return parseChangelogMarkdown(readFileSync(changelogPath, "utf8"));
}

function normalizeEntry(entry: ChangelogEntry): ChangelogEntry {
  return {
    ...entry,
    description: entry.description.trim(),
  };
}
