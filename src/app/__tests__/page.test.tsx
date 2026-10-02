import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isValidElement, type ReactNode } from "react";
import { dictionary } from "@/lib/i18n";

/**
 * Tests for the public, unauthenticated root landing (`src/app/page.tsx`).
 *
 * Three suites:
 *   1. Source-file assertions (the `/t/[slug]` + `operator-primitives` convention):
 *      guards against reintroducing the root redirect, missing CTA targets, or
 *      hard-coded colors that violate the DESIGN.md Don'ts.
 *   2. Render-tree assertions (the `login` / `client/login` convention): walks
 *      the rendered React tree to confirm the two `<Link>` CTAs point to
 *      `/login` and `/client/login`, the data-testid markers are present, and
 *      the language fallback (es default, en switch, fr fallback) works.
 *   3. Dictionary parity: every `landing*` key is present in BOTH `es` and
 *      `en`, so the spec's "missing key never shows raw keys" scenario is
 *      enforced at test time.
 *
 * See: `openspec/changes/pagina-inicial/specs/public-landing/spec.md` for the
 * full behavioral contract.
 */

function textContent(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  const children = (node.props as Record<string, ReactNode>).children;
  return Array.isArray(children) ? children.map(textContent).join("") : textContent(children);
}

type TestElement = React.ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean) {
  const matches: TestElement[] = [];
  function walk(current: ReactNode) {
    if (!isValidElement(current)) return;
    const element = current as TestElement;
    if (predicate(element)) matches.push(element);
    const children = (element.props as Record<string, ReactNode>).children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  }
  walk(node);
  return matches;
}

describe("/page source assertions", () => {
  it("removes the root redirect and serves the public landing with token discipline", () => {
    const page = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

    // The original 5-line redirect must be gone.
    expect(page).not.toContain('redirect("/dashboard")');

    // Two CTA targets — both as real next/link <Link href> literals.
    expect(page).toContain('href="/login"');
    expect(page).toContain('href="/client/login"');

    // Split markers are grep-able anchors for both assertion suites.
    expect(page).toContain('data-testid="landing-agent-side"');
    expect(page).toContain('data-testid="landing-traveler-side"');
    expect(page).toContain('data-testid="landing-agent-cta"');
    expect(page).toContain('data-testid="landing-traveler-cta"');

    // Wine agent side uses the brand token; gold traveler side uses the
    // accent token (both are committed `--operator-*` tokens, no new color).
    expect(page).toContain("var(--operator-brand)");
    expect(page).toContain("var(--operator-accent)");

    // DESIGN.md Don'ts — no hard-coded brand hex literals in the page.
    expect(page).not.toContain("#510034");
    expect(page).not.toContain("#ffad18");

    // i18n is wired, not hard-coded to Spanish.
    expect(page).toContain("getLangFromSearchParams");
  });
});

describe("/page render assertions", () => {
  it("renders the two CTAs to /login and /client/login with ES labels by default", async () => {
    const { default: LandingPage } = await import("../page");
    const element = await LandingPage({ searchParams: Promise.resolve({}) });

    expect(findElements(element, (n) => n.props["data-testid"] === "landing-hubit-hero")).toHaveLength(1);
    expect(findElements(element, (n) => n.props["data-testid"] === "landing-split")).toHaveLength(1);
    expect(findElements(element, (n) => n.props["data-testid"] === "landing-agent-side")).toHaveLength(1);
    expect(findElements(element, (n) => n.props["data-testid"] === "landing-traveler-side")).toHaveLength(1);

    const agentLinks = findElements(element, (n) => n.props["data-testid"] === "landing-agent-cta");
    const travelerLinks = findElements(element, (n) => n.props["data-testid"] === "landing-traveler-cta");
    expect(agentLinks).toHaveLength(1);
    expect(travelerLinks).toHaveLength(1);
    expect(agentLinks[0]?.props.href).toBe("/login");
    expect(travelerLinks[0]?.props.href).toBe("/client/login");

    const text = textContent(element);
    expect(text).toContain("Acceder Agentes");
    expect(text).toContain("Ingresar Viajeros");
  });

  it("switches all copy to English when ?lang=en is provided", async () => {
    const { default: LandingPage } = await import("../page");
    const element = await LandingPage({ searchParams: Promise.resolve({ lang: "en" }) });

    const text = textContent(element);
    expect(text).toContain("Agent Login");
    expect(text).toContain("Traveler Login");
    expect(text).not.toContain("Acceder Agentes");
    expect(text).not.toContain("Ingresar Viajeros");
  });

  it("falls back to Spanish for unsupported lang values (no raw key, no English)", async () => {
    const { default: LandingPage } = await import("../page");
    const element = await LandingPage({ searchParams: Promise.resolve({ lang: "fr" }) });

    const text = textContent(element);
    expect(text).toContain("Acceder Agentes");
    expect(text).toContain("Ingresar Viajeros");
    expect(text).not.toContain("Agent Login");
    expect(text).not.toContain("landingAgentLabel");
  });
});

describe("landing dictionary parity", () => {
  it("every landing* key exists in both es and en with non-empty string values", () => {
    const esKeys = Object.keys(dictionary.es);
    const enKeys = Object.keys(dictionary.en);
    const landingEs = esKeys.filter((k) => k.startsWith("landing")).sort();
    const landingEn = enKeys.filter((k) => k.startsWith("landing")).sort();

    // Same set of landing keys in both languages — enforces "missing key never shows raw keys".
    expect(landingEs.length).toBeGreaterThan(0);
    expect(landingEs).toEqual(landingEn);

    for (const key of landingEs) {
      const esValue = dictionary.es[key as keyof (typeof dictionary)["es"]];
      const enValue = dictionary.en[key as keyof (typeof dictionary)["en"]];
      expect(typeof esValue).toBe("string");
      expect(typeof enValue).toBe("string");
      expect((esValue as string).length).toBeGreaterThan(0);
      expect((enValue as string).length).toBeGreaterThan(0);
    }
  });

  it("pinned Spanish labels match the spec verbatim", () => {
    expect(dictionary.es.landingAgentLabel).toBe("Acceder Agentes");
    expect(dictionary.es.landingTravelerLabel).toBe("Ingresar Viajeros");
  });
});
