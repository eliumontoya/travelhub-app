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

vi.mock("@/lib/data/services", () => ({
  getServiceForClientTrip: vi.fn(),
  getServicesProgressForClient: vi.fn(),
}));

vi.mock("../login/actions", () => ({
  clientLogout: vi.fn(),
}));

import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientHomeTrips, getClientProfileForHome } from "@/lib/data";
import {
  getServiceForClientTrip,
  getServicesProgressForClient,
} from "@/lib/data/services";
import { clientLogout } from "../login/actions";

function getText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  if (typeof node.type === "function") {
    return getText((node.type as (props: unknown) => ReactNode)(node.props));
  }
  const children = (node.props as Record<string, ReactNode>).children;
  if (Array.isArray(children)) return children.map(getText).join("");
  return getText(children);
}

function findLinks(node: ReactNode): Array<{ href: string; text: string }> {
  const results: Array<{ href: string; text: string }> = [];
  function walk(n: ReactNode) {
    if (!isValidElement(n)) return;
    if (typeof n.type === "function") {
      walk((n.type as (props: unknown) => ReactNode)(n.props));
      return;
    }
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
    if (typeof n.type === "function") {
      walk((n.type as (props: unknown) => ReactNode)(n.props));
      return;
    }
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


type TestElement = React.ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: TestElement) => boolean) {
  const matches: TestElement[] = [];
  function walk(current: ReactNode) {
    if (!isValidElement(current)) return;
    if (typeof current.type === "function") {
      walk((current.type as (props: unknown) => ReactNode)(current.props));
      return;
    }
    const element = current as TestElement;
    if (predicate(element)) matches.push(element);
    const children = (element.props as Record<string, ReactNode>).children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  }
  walk(node);
  return matches;
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

  it("renders the authenticated account inside the shared traveler corporate surfaces", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "c1", expiresAt: Date.now() + 10000 });
    vi.mocked(getClientProfileForHome).mockResolvedValue({
      name: "Ana Pérez",
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

    expect(findElements(element, (node) => node.props["data-testid"] === "client-home-atmosphere")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "client-profile-surface")).toHaveLength(1);
    expect(findElements(element, (node) => node.props["data-testid"] === "client-trips-surface")).toHaveLength(1);
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

  it("shows a Documentos link and a text progress counter per trip", async () => {
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
    vi.mocked(getClientHomeTrips).mockResolvedValue([
      {
        id: "t1",
        title: "Luna de miel en Italia",
        slug: "italia-perez-2026",
        startDate: "2026-09-10",
        endDate: "2026-09-17",
        status: "published",
        currency: "EUR",
        travelerCount: 2,
      },
    ]);
    vi.mocked(getServiceForClientTrip).mockResolvedValue({
      id: "svc1",
      tripId: "t1",
      clientId: "c1",
      serviceType: "trip_documents",
      status: "active",
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(getServicesProgressForClient).mockResolvedValue(
      new Map([["svc1", { completed: 2, total: 5 }]])
    );

    const { default: ClientHomePage } = await import("../page");
    const element = await ClientHomePage();
    const links = findLinks(element);
    const text = getText(element);

    const docsLink = links.find((l) => l.href === "/client/trips/t1/documents");
    expect(docsLink).toBeDefined();
    expect(docsLink?.text).toContain("Documentos");
    expect(text).toContain("2/5");
  });
});
