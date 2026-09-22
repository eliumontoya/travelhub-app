import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture env state at module load so each test can run with a controlled
// environment. `playwright.config.ts` reads `BASE_URL` and
// `VERCEL_PROTECTION_BYPASS` at module-load time, so we must reset modules
// and mutate `process.env` before each dynamic import.
const ORIGINAL_ENV = { ...process.env };

type WebServerConfig = {
  command: string;
  url: string;
  reuseExistingServer: boolean;
  timeout: number;
};

type ProjectConfig = {
  name: string;
  testDir?: string;
  default?: boolean;
  workers?: number;
  use?: {
    baseURL?: string;
    extraHTTPHeaders?: Record<string, string>;
  };
};

type ConfigShape = {
  testDir?: string;
  webServer?: WebServerConfig;
  projects?: ProjectConfig[];
};

async function loadConfig(): Promise<ConfigShape> {
  const mod = await import("../../playwright.config");
  return mod.default as ConfigShape;
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.BASE_URL;
  delete process.env.VERCEL_PROTECTION_BYPASS;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("playwright.config.ts — two-project mock/preview split", () => {
  it("declares exactly two projects named 'mock' and 'preview'", async () => {
    const config = await loadConfig();
    expect(config.projects).toHaveLength(2);
    const names = config.projects?.map((p) => p.name).sort();
    expect(names).toEqual(["mock", "preview"]);
  });

  it("mock project pins testDir, workers, baseURL and skips the bypass header", async () => {
    const config = await loadConfig();
    const mock = config.projects?.find((p) => p.name === "mock");
    expect(mock).toBeDefined();
    expect(mock?.testDir).toBe("e2e/mock");
    expect(mock?.workers).toBe(1);
    expect(mock?.use?.baseURL).toBe("http://localhost:3000");
    expect(
      mock?.use?.extraHTTPHeaders?.["x-vercel-protection-bypass"],
    ).toBeUndefined();
  });

  it("preview project targets e2e/preview with default:false and BASE_URL baseURL", async () => {
    process.env.BASE_URL = "https://preview.example.vercel.app";
    const config = await loadConfig();
    const preview = config.projects?.find((p) => p.name === "preview");
    expect(preview).toBeDefined();
    expect(preview?.testDir).toBe("e2e/preview");
    expect(preview?.default).toBe(false);
    expect(preview?.use?.baseURL).toBe("https://preview.example.vercel.app");
  });

  it("preview project sets the bypass header iff VERCEL_PROTECTION_BYPASS is set", async () => {
    process.env.BASE_URL = "https://preview.example.vercel.app";
    process.env.VERCEL_PROTECTION_BYPASS = "secret-token";
    const config = await loadConfig();
    const preview = config.projects?.find((p) => p.name === "preview");
    expect(preview?.use?.extraHTTPHeaders?.["x-vercel-protection-bypass"]).toBe(
      "secret-token",
    );
  });

  it("preview project omits the bypass header when VERCEL_PROTECTION_BYPASS is unset", async () => {
    process.env.BASE_URL = "https://preview.example.vercel.app";
    const config = await loadConfig();
    const preview = config.projects?.find((p) => p.name === "preview");
    expect(
      preview?.use?.extraHTTPHeaders?.["x-vercel-protection-bypass"],
    ).toBeUndefined();
  });

  it("starts a local dev server via webServer when BASE_URL is unset", async () => {
    delete process.env.BASE_URL;
    const config = await loadConfig();
    expect(config.webServer).toBeDefined();
    expect(config.webServer?.command).toBe("npm run dev");
    expect(config.webServer?.url).toBe("http://localhost:3000");
  });

  it("skips webServer when BASE_URL is set (preview target)", async () => {
    process.env.BASE_URL = "https://preview.example.vercel.app";
    const config = await loadConfig();
    expect(config.webServer).toBeUndefined();
  });
});
