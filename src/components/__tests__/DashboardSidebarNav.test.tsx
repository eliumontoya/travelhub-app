import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname }));

import { DashboardSidebarNav } from "@/components/DashboardSidebarNav";

function activeLabels(html: string) {
  return [...html.matchAll(/aria-current="page"[^>]*>(.*?)<\/a>/g)].map((match) =>
    match[1].replace(/<span[^>]*>.*?<\/span>/g, "").trim()
  );
}

describe("DashboardSidebarNav", () => {
  it("highlights Inicio only on the dashboard root", () => {
    usePathname.mockReturnValue("/dashboard");

    const html = renderToStaticMarkup(<DashboardSidebarNav isAdmin />);

    expect(activeLabels(html)).toEqual(["Inicio"]);
  });

  it("highlights the matching trip section instead of Inicio", () => {
    usePathname.mockReturnValue("/dashboard/trips/trip-1");

    const html = renderToStaticMarkup(<DashboardSidebarNav isAdmin />);

    expect(activeLabels(html)).toEqual(["Viajes"]);
  });

  it("uses the most specific admin section for nested settings routes", () => {
    usePathname.mockReturnValue("/dashboard/settings/accounts");

    const html = renderToStaticMarkup(<DashboardSidebarNav isAdmin />);

    expect(activeLabels(html)).toEqual(["Cuentas"]);
  });
});
