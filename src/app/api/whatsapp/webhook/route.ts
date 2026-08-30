import { NextRequest, NextResponse } from "next/server";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound-service";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp/signature";
import { WhatsAppStoreConfigurationError } from "@/lib/whatsapp/store";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    process.env.WHATSAPP_VERIFY_TOKEN &&
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = verifyWhatsAppWebhookSignature({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
  });

  if (!signature.ok) {
    if (signature.reason === "missing_secret") {
      return NextResponse.json({ error: "WhatsApp webhook signing secret is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const result = await processWhatsAppWebhookPayload(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WhatsAppStoreConfigurationError) {
      return NextResponse.json({ error: "WhatsApp webhook persistence is not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "WhatsApp webhook processing failed" }, { status: 500 });
  }
}
