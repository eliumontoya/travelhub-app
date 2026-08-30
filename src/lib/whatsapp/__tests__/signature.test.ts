import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp/signature";

function sign(rawBody: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("verifyWhatsAppWebhookSignature", () => {
  const secret = "meta-app-secret";
  const rawBody = JSON.stringify({ entry: [{ id: "entry-1" }] });

  it("accepts Meta sha256 signatures for the exact raw body bytes", () => {
    expect(
      verifyWhatsAppWebhookSignature({
        rawBody,
        signatureHeader: sign(rawBody, secret),
        appSecret: secret,
      })
    ).toEqual({ ok: true });
  });

  it("rejects a valid signature when the raw body bytes change", () => {
    const semanticallySameBody = JSON.stringify({ entry: [{ id: "entry-1" }] }, null, 2);

    expect(
      verifyWhatsAppWebhookSignature({
        rawBody: semanticallySameBody,
        signatureHeader: sign(rawBody, secret),
        appSecret: secret,
      })
    ).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("classifies missing secret and missing signature before comparing", () => {
    expect(
      verifyWhatsAppWebhookSignature({
        rawBody,
        signatureHeader: sign(rawBody, secret),
        appSecret: "",
      })
    ).toEqual({ ok: false, reason: "missing_secret" });
    expect(
      verifyWhatsAppWebhookSignature({ rawBody, signatureHeader: null, appSecret: secret })
    ).toEqual({ ok: false, reason: "missing_signature" });
  });

  it.each([
    ["wrong prefix", `sha1=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`],
    ["non-hex digest", "sha256=not-hex"],
    ["short digest", "sha256=abc123"],
  ])("rejects malformed signatures: %s", (_name, signatureHeader) => {
    expect(
      verifyWhatsAppWebhookSignature({ rawBody, signatureHeader, appSecret: secret })
    ).toEqual({ ok: false, reason: "malformed_signature" });
  });

  it("rejects same-length but mismatched signatures", () => {
    const valid = sign(rawBody, secret);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("0") ? "1" : "0"}`;

    expect(
      verifyWhatsAppWebhookSignature({ rawBody, signatureHeader: tampered, appSecret: secret })
    ).toEqual({ ok: false, reason: "invalid_signature" });
  });
});
