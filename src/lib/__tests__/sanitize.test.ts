import { describe, it, expect } from "vitest";
import { sanitizeNote, noteToPlainText } from "@/lib/sanitize";

describe("sanitizeNote", () => {
  it("keeps allowed formatting tags", () => {
    const html = "<p>Texto <strong>importante</strong> y <em>énfasis</em></p><ul><li>uno</li></ul>";
    expect(sanitizeNote(html)).toContain("<strong>importante</strong>");
    expect(sanitizeNote(html)).toContain("<em>énfasis</em>");
    expect(sanitizeNote(html)).toContain("<ul><li>uno</li></ul>");
  });

  it("strips scripts and event handlers", () => {
    const html = '<p onclick="alert(1)">hola<script>alert(2)</script></p>';
    const safe = sanitizeNote(html);
    expect(safe).not.toContain("<script");
    expect(safe).not.toContain("onclick");
    expect(safe).toContain("hola");
  });

  it("neutralizes javascript: links and forces safe link attributes", () => {
    const html = '<a href="javascript:alert(1)">x</a><a href="https://ok.com">y</a>';
    const safe = sanitizeNote(html);
    expect(safe).not.toContain("javascript:");
    expect(safe).toContain('target="_blank"');
    expect(safe).toContain('rel="noopener noreferrer"');
    expect(safe).toContain('href="https://ok.com"');
  });

  it("returns empty string for nullish input", () => {
    expect(sanitizeNote(null)).toBe("");
    expect(sanitizeNote(undefined)).toBe("");
    expect(sanitizeNote("")).toBe("");
  });

  it("preserves plain text notes unchanged", () => {
    expect(sanitizeNote("nota simple")).toBe("nota simple");
  });
});

describe("noteToPlainText", () => {
  it("strips tags to plain text", () => {
    expect(noteToPlainText("<p>Hola <strong>mundo</strong></p>")).toBe("Hola mundo");
  });

  it("returns empty for nullish input", () => {
    expect(noteToPlainText(null)).toBe("");
  });
});
