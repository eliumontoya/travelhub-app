import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

vi.mock("../actions", () => ({
  clientSignIn: vi.fn(),
}));

import { clientSignIn } from "../actions";

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

describe("/client/login page", () => {
  it("renders the traveler sign-in contract inside the shared corporate surface", async () => {
    const { default: ClientLoginPage } = await import("../page");
    const element = await ClientLoginPage({
      searchParams: Promise.resolve({ redirectTo: "/t/italia-perez-2026" }),
    });
    const forms = findElements(element, (node) => node.type === "form");
    const inputs = findElements(element, (node) => node.type === "input");
    const labels = findElements(element, (node) => node.type === "label");
    const text = textContent(element);

    expect(findElements(element, (node) => node.props["data-testid"] === "client-login-atmosphere")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "client-login-panel")).toHaveLength(1);
    expect(forms).toHaveLength(1);
    expect(forms[0]?.props.action).toBe(clientSignIn);
    expect(inputs.some((node) => node.props.name === "email" && node.props.type === "email" && node.props.id === "email")).toBe(true);
    expect(inputs.some((node) => node.props.name === "pin" && node.props.type === "password" && node.props.id === "pin")).toBe(true);
    expect(inputs.some((node) => node.props.name === "redirectTo" && node.props.value === "/t/italia-perez-2026")).toBe(true);
    expect(labels.some((node) => textContent(node) === "Email" && node.props.htmlFor === "email")).toBe(true);
    expect(labels.some((node) => textContent(node) === "PIN" && node.props.htmlFor === "pin")).toBe(true);
    expect(text).toContain("Acceso para clientes");
    expect(text).toContain("Entrar");
  });

  it("keeps every login status visible", async () => {
    const { default: ClientLoginPage } = await import("../page");
    const element = await ClientLoginPage({
      searchParams: Promise.resolve({ status: "rate_limited" }),
    });

    expect(textContent(element)).toContain("Demasiados intentos fallidos");
  });
});
