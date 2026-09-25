import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surface = readFileSync(new URL("../OperatorSurface.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("../OperatorButton.tsx", import.meta.url), "utf8");
const tokens = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");

describe("operator design-system primitives", () => {
  it("uses semantic corporate tokens for reusable surfaces and actions", () => {
    expect(tokens).toContain("--operator-surface");
    expect(tokens).toContain("--operator-action");
    expect(tokens).toContain("--operator-focus");
    expect(surface).toContain("bg-[var(--operator-surface)]");
    expect(surface).toContain("shadow-[var(--operator-shadow-card)]");
    expect(button).toContain("bg-[var(--operator-action)]");
    expect(button).toContain("focus-visible:outline-[var(--operator-focus)]");
  });
});
