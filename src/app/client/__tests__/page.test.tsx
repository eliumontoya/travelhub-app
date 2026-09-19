import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, ReactNode } from "react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getClientProfileForHome: vi.fn(),
  getClientHomeTrips: vi.fn(),
}));

vi.mock("../login/actions", () => ({
  clientLogout: vi.fn(),
}));

import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientHomeTrips, getClientProfileForHome } from "@/lib/data";
import { clientLogout } from "../login/actions";

function getText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  const children = (node.props as Record<string, ReactNode>).children;
  if (Array.isArray(children)) return children.map(getText).join("");
  return getText(children);
}

function findLinks(node: ReactNode): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = [];
  function walk(n: ReactNode) {
    if (!isValidElement(n)) return;
    const type = n.type;
    const props = n.props as Record<string, unknown>;
    if (type === "a") {
      results.push({ href: props.href as string, text: getText(n) });
    }
    const children = props.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children as ReactNode);
  }
  walk(node);
  return results;
}

function findForms(node: ReactNode): Array<{ action?: unknown; text: string }> {
  const results: Array<{ action?: unknown; text: string }> = [];
  function walk(n: ReactNode) {
    if (!isValidElement(n)) return;
    const type = n.type;
    const props = n.props as Record<string, unknown>;
    if (type === "form") {
      results.push({ action: props.action, text: getText(n) });
    }
    const children = props.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children as ReactNode);
  }
  walk(node);
  return results;
}

describe("/client home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when there is no session", async () => {
    vi.mocked(getClientSession).mockResolvedValue(null);

    const { default: ClientHomePage } = await import("../page");

    await expect(ClientHomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/client/login?redirectTo=/client");
  });

  it("renders the read-only profile for an authenticated client", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 10000 });
    vi.mocked(getClientProfileForHome).mockResolvedValue({
      name: "Ana y Roberto Pérez",
      email: "ana.perez@example.com",
      phone: "+52 55 1234 5678",
      whatsapp: "+52 55 1234 5678",
      birthDate: "1990-08-01",
      notes: "Luna de miel",
      referralSource: null,
      coverImageUrl: "https://example.com/cover.jpg",
    });
    vi.mocked(getClientHomeTrips).mockResolvedValue([]);

    const { default: ClientHomePage } = await import("../page");
    const element = await ClientHomePage();
    const text = getText(element);

    expect(text).toContain("Ana y Roberto Pérez");
    expect(text).toContain("ana.perez@example.com");
    expect(text).toContain("+52 55 1234 5678");
    expect(text).toContain("Luna de miel");
  });

  it("shows a published trip with a link and a draft trip without a link", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 10000 });
    vi.mocked(getClientProfileForHome).mockResolvedValue({
      name: "Ana y Roberto Pérez",
      email: "ana.perez@example.com",
      phone: "",
      whatsapp: "",
      birthDate: "",
      notes: "",
      referralSource: null,
    });
    vi.mocked(getClientHomeTrips).mockResolvedValue([
      {
        id: "t-published",
        title: "Luna de miel en Italia",
        slug: "italia-perez-2026",
        startDate: "2026-09-10",
        endDate: "2026-09-17",
        status: "published",
        currency: "EUR",
        travelerCount: 2,
      },
      {
        id: "t-draft",
        title: "Aventura en Cancún",
        slug: "cancun-gomez-2026",
        startDate: "2026-12-15",
        endDate: "2026-12-20",
        status: "draft",
        currency: "MXN",
        travelerCount: 4,
      },
    ]);

    const { default: ClientHomePage } = await import("../page");
    const element = await ClientHomePage();
    const links = findLinks(element);
    const text = getText(element);

    const publishedLink = links.find((l) => l.href === "/t/italia-perez-2026");
    expect(publishedLink).toBeDefined();
    expect(publishedLink?.text).toContain("Luna de miel en Italia");

    expect(text).toContain("Aventura en Cancún");
    expect(links.some((l) => l.href === "/t/cancun-gomez-2026")).toBe(false);
  });

  it("renders a logout form posting to the clientLogout action", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 10000 });
    vi.mocked(getClientProfileForHome).mockResolvedValue({
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      whatsapp: "",
      birthDate: "",
      notes: "",
      referralSource: null,
    });
    vi.mocked(getClientHomeTrips).mockResolvedValue([]);

    const { default: ClientHomePage } = await import("../page");
    const element = await ClientHomePage();
    const forms = findForms(element);

    expect(forms.length).toBeGreaterThan(0);
    expect(forms.some((f) => f.action === clientLogout)).toBe(true);
  });
});
