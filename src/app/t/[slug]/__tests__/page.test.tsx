import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { isValidElement, ReactNode } from "react";
import type { TripWithDetails } from "@/types";

vi.mock("@/lib/data", () => ({
  canClientAddActivities: vi.fn(),
  getSiteSettings: vi.fn(),
  getTripWithDetails: vi.fn(),
  hasOwnedServiceRequirements: vi.fn(),
}));

vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

vi.mock("@/lib/weather", () => ({
  getDailyWeather: vi.fn(),
}));

import {
  canClientAddActivities,
  getSiteSettings,
  getTripWithDetails,
  hasOwnedServiceRequirements,
} from "@/lib/data";
import { getClientSession } from "@/lib/client-auth";

const trip = {
  id: "trip-1",
  slug: "viaje-de-prueba",
  status: "published",
  title: "Viaje de prueba",
  startDate: "2026-10-01",
  endDate: "2026-10-07",
  travelerCount: 1,
  showCostsToClient: false,
  currency: "MXN",
  days: [],
  packingItems: [
    { id: "packing-1", tripId: "trip-1", label: "Pasaporte", checked: false, sortOrder: 0 },
  ],
  photos: [],
  documents: [],
  instructions: undefined,
} as unknown as TripWithDetails;

function getText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  const children = (node.props as Record<string, ReactNode>).children;
  return Array.isArray(children) ? children.map(getText).join("") : getText(children);
}

function findLinks(node: ReactNode): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  function walk(current: ReactNode) {
    if (!isValidElement(current)) return;
    const props = current.props as Record<string, unknown>;
    if (current.type === "a") links.push({ href: props.href as string, text: getText(current) });
    const children = props.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children as ReactNode);
  }
  walk(node);
  return links;
}

async function renderPage() {
  const { default: PublicTripPage } = await import("../page");
  return PublicTripPage({
    params: Promise.resolve({ slug: trip.slug }),
    searchParams: Promise.resolve({}),
  });
}

describe("/t/[slug] service-document callout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTripWithDetails).mockResolvedValue(trip);
    vi.mocked(getSiteSettings).mockResolvedValue({
      agencyName: "TravelHub",
      email: "hello@example.com",
      phone: "+52 55 0000 0000",
    } as Awaited<ReturnType<typeof getSiteSettings>>);
    vi.mocked(canClientAddActivities).mockResolvedValue(false);
  });

  it("shows the signed-in traveler's upload callout below the packing checklist", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "client-1", expiresAt: Date.now() + 10000 });
    vi.mocked(hasOwnedServiceRequirements).mockResolvedValue(true);

    const element = await renderPage();
    const text = getText(element);
    const calloutLink = findLinks(element).find((link) => link.href === "/client/trips/trip-1/documents");

    expect(hasOwnedServiceRequirements).toHaveBeenCalledWith("trip-1", "client-1");
    expect(text).toContain("Documentos pendientes");
    expect(text.indexOf("Checklist de equipaje")).toBeLessThan(text.indexOf("Documentos pendientes"));
    expect(calloutLink?.text).toContain("Subir documentos");
  });

  it("does not resolve or render the callout for anonymous viewers", async () => {
    vi.mocked(getClientSession).mockResolvedValue(null);

    const element = await renderPage();

    expect(getText(element)).not.toContain("Documentos pendientes");
    expect(hasOwnedServiceRequirements).not.toHaveBeenCalled();
  });

  it("does not render the callout when the signed-in viewer has no trip service", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "unassigned-client", expiresAt: Date.now() + 10000 });
    vi.mocked(hasOwnedServiceRequirements).mockResolvedValue(false);

    const element = await renderPage();

    expect(hasOwnedServiceRequirements).toHaveBeenCalledWith("trip-1", "unassigned-client");
    expect(getText(element)).not.toContain("Documentos pendientes");
  });

  it("does not render the callout when the traveler's service has no requirements", async () => {
    vi.mocked(getClientSession).mockResolvedValue({ clientId: "client-1", expiresAt: Date.now() + 10000 });
    vi.mocked(hasOwnedServiceRequirements).mockResolvedValue(false);

    const element = await renderPage();

    expect(hasOwnedServiceRequirements).toHaveBeenCalledWith("trip-1", "client-1");
    expect(getText(element)).not.toContain("Documentos pendientes");
  });
});

describe("/t/[slug] corporate traveler presentation", () => {
  it("uses the shared corporate surface system for the public itinerary and traveler activity controls", () => {
    const page = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
    const activityForm = readFileSync(new URL("../../../../components/TravelerActivityForm.tsx", import.meta.url), "utf8");
    const activityPanel = readFileSync(new URL("../../../../components/TravelerActivityAddFormPanel.tsx", import.meta.url), "utf8");

    expect(page).toContain("bg-[var(--operator-canvas)]");
    expect(page).toContain("from-[var(--operator-brand-strong)]");
    expect(page).toContain("border-[var(--operator-border)]");
    expect(activityForm).toContain("OperatorButton");
    expect(activityPanel).toContain("OperatorButton");
  });
});
