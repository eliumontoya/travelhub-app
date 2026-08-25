import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageToggle } from "@/components/LanguageToggle";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/t/test-trip",
  useSearchParams: () => new URLSearchParams(),
}));

describe("LanguageToggle", () => {
  it("renders dark variant classes by default", () => {
    const html = renderToStaticMarkup(<LanguageToggle lang="es" />);
    expect(html).toContain("border-white/40");
    expect(html).toContain("bg-white text-gray-900");
  });

  it("renders light variant classes when variant is light", () => {
    const html = renderToStaticMarkup(<LanguageToggle lang="es" variant="light" />);
    expect(html).toContain("border-gray-300");
    expect(html).toContain("bg-gray-900 text-white");
  });

  it("renders light active state for the other language", () => {
    const html = renderToStaticMarkup(<LanguageToggle lang="en" variant="light" />);
    expect(html).toContain("border-gray-300");
    expect(html).toContain("bg-gray-900 text-white");
  });
});
