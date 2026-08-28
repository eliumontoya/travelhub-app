import { describe, expect, it } from "vitest";
import { parseChangelogMarkdown } from "@/lib/changelog";

describe("parseChangelogMarkdown", () => {
  it("parses dated entries from Changes.md format", () => {
    const entries = parseChangelogMarkdown(`# Changes

Intro text ignored.

## 2026-08-28 — Primera mejora
Una línea.
Otra línea.

## 2026-08-27 - Segunda mejora
Descripción corta.
`);

    expect(entries).toEqual([
      {
        date: "2026-08-28",
        title: "Primera mejora",
        description: "Una línea. Otra línea.",
      },
      {
        date: "2026-08-27",
        title: "Segunda mejora",
        description: "Descripción corta.",
      },
    ]);
  });
});
