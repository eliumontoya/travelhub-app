import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import {
  issueClientSession,
  verifyClientCredentials,
  destroyClientSession,
} from "@/lib/client-auth";
import { clientLogout, clientSignIn } from "../actions";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/client-auth", () => ({
  verifyClientCredentials: vi.fn(),
  issueClientSession: vi.fn(),
  destroyClientSession: vi.fn(),
}));

function createFormData(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.append(key, value);
  }
  return formData;
}

describe("client login actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clientSignIn", () => {
    it("issues a session and redirects on valid credentials", async () => {
      vi.mocked(verifyClientCredentials).mockResolvedValue({
        ok: true,
        clientId: "c1",
      });

      const formData = createFormData({
        email: "ana.perez@example.com",
        pin: "123456",
      });

      await expect(clientSignIn(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(verifyClientCredentials).toHaveBeenCalledWith(
        "ana.perez@example.com",
        "123456"
      );
      expect(issueClientSession).toHaveBeenCalledWith("c1");
      expect(redirect).toHaveBeenCalledWith("/client/login?status=success");
    });

    it("redirects to invalid status when credentials do not match", async () => {
      vi.mocked(verifyClientCredentials).mockResolvedValue({
        ok: false,
        reason: "invalid",
      });

      const formData = createFormData({
        email: "ana.perez@example.com",
        pin: "wrongpin",
      });

      await expect(clientSignIn(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(issueClientSession).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/client/login?status=invalid");
    });

    it("redirects to rate_limited status when the email is locked out", async () => {
      vi.mocked(verifyClientCredentials).mockResolvedValue({
        ok: false,
        reason: "rate_limited",
      });

      const formData = createFormData({
        email: "ana.perez@example.com",
        pin: "123456",
      });

      await expect(clientSignIn(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(issueClientSession).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith(
        "/client/login?status=rate_limited"
      );
    });

    it("uses the provided redirectTo when credentials are valid", async () => {
      vi.mocked(verifyClientCredentials).mockResolvedValue({
        ok: true,
        clientId: "c1",
      });

      const formData = createFormData({
        email: "ana.perez@example.com",
        pin: "123456",
        redirectTo: "/t/italia-perez-2026",
      });

      await expect(clientSignIn(formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(redirect).toHaveBeenCalledWith("/t/italia-perez-2026");
    });
  });

  describe("clientLogout", () => {
    it("destroys the session and redirects to the login page", async () => {
      await expect(clientLogout()).rejects.toThrow("NEXT_REDIRECT");

      expect(destroyClientSession).toHaveBeenCalledTimes(1);
      expect(redirect).toHaveBeenCalledWith("/client/login?status=loggedOut");
    });
  });
});
