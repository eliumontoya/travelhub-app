import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "code",
  "pre",
  "hr",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
  disallowedTagsMode: "discard",
};

/**
 * Sanitize note HTML for safe rendering. Strips scripts, event handlers,
 * style attributes and unsafe URL schemes. Used as the single choke point
 * before any note text reaches the public traveler view.
 */
export function sanitizeNote(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Strip note HTML down to plain text (for CSV / non-HTML consumers). */
export function noteToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
