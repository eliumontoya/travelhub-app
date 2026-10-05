import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  redirectMock,
  revalidatePathMock,
  updateSiteSettingsMock,
  uploadSiteLogoMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  updateSiteSettingsMock: vi.fn(),
  uploadSiteLogoMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  updateSiteSettings: updateSiteSettingsMock,
  uploadSiteLogo: uploadSiteLogoMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { requireRole } from "@/lib/auth/roles";
import { updateSettingsAction, signOutAction } from "../actions";

function validSettingsFormData() {
  const formData = new FormData();
  formData.set("email", "contacto@example.com");
  formData.set("phone", "+52 555 000 0000");
  formData.set("agencyName", "TravelHub");
  formData.set("logoUrl", "https://example.com/logo.png");
  return formData;
}

describe("updateSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    updateSiteSettingsMock.mockResolvedValue({});
    uploadSiteLogoMock.mockResolvedValue("https://example.com/uploaded-logo.png");
  });

  it("redirects to the dashboard success confirmation after a successful save", async () => {
    await expect(updateSettingsAction(null, validSettingsFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?settingsSaved=1",
    );

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateSiteSettingsMock).toHaveBeenCalledWith({
      email: "contacto@example.com",
      phone: "+52 555 000 0000",
      agencyName: "TravelHub",
      logoUrl: "https://example.com/logo.png",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/t/[slug]", "page");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard?settingsSaved=1");
  });

  it("keeps invalid saves on the settings form without redirecting or persisting", async () => {
    const formData = validSettingsFormData();
    formData.set("email", "correo-invalido");

    await expect(updateSettingsAction(null, formData)).resolves.toEqual({
      error: "Ingresa un email válido.",
    });

    expect(updateSiteSettingsMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("denies an unauthorized caller without persisting", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(updateSettingsAction(null, validSettingsFormData())).rejects.toThrow(
      "Unauthorized",
    );

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateSiteSettingsMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs out without requiring a role", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(requireRole).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
