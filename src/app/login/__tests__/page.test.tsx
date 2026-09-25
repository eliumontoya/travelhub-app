import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock("../actions", () => ({
  signIn: vi.fn(),
}));

import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn } from "../actions";

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

describe("/login page", () => {
  it("renders the premium branded panel while preserving the operator sign-in contract", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    const { default: LoginPage } = await import("../page");
    const element = await LoginPage({ searchParams: Promise.resolve({ redirectTo: "/dashboard" }) });
    const text = textContent(element);
    const forms = findElements(element, (node) => node.type === "form");
    const inputs = findElements(element, (node) => node.type === "input");
    const labels = findElements(element, (node) => node.type === "label");

    expect(findElements(element, (node) => node.props["data-testid"] === "login-atmosphere")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "login-office-scene")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "login-window-grid")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "login-sunset-skyline")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "login-panel")).toHaveLength(1);
    expect(forms).toHaveLength(1);
    expect(forms[0]?.props.action).toBe(signIn);
    expect(inputs.some((node) => node.props.name === "email" && node.props.type === "email" && node.props.id === "email")).toBe(true);
    expect(inputs.some((node) => node.props.name === "password" && node.props.type === "password" && node.props.id === "password")).toBe(true);
    expect(labels.some((node) => textContent(node) === "Email" && node.props.htmlFor === "email")).toBe(true);
    expect(labels.some((node) => textContent(node) === "Contraseña" && node.props.htmlFor === "password")).toBe(true);
    expect(inputs.some((node) => node.props.name === "redirectTo" && node.props.value === "/dashboard")).toBe(true);
    expect(text).toContain("Email");
    expect(text).toContain("Contraseña");
    expect(text).toContain("Entrar");
  });

  it("keeps configuration guidance and server errors visible", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    const { default: LoginPage } = await import("../page");
    const element = await LoginPage({ searchParams: Promise.resolve({ error: "Credenciales inválidas" }) });
    const text = textContent(element);

    expect(text).toContain("Credenciales inválidas");
    expect(text).toContain("Supabase no está configurado todavía.");
    expect(text).toContain("SUPABASE_SETUP.md");
  });
});
