"use server";

import { redirect } from "next/navigation";
import {
  issueClientSession,
  verifyClientCredentials,
  destroyClientSession,
} from "@/lib/client-auth";

export async function clientSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/client/login?status=success").trim();

  const result = await verifyClientCredentials(email, pin);

  if (!result.ok) {
    redirect(`/client/login?status=${result.reason}`);
  }

  await issueClientSession(result.clientId);
  redirect(redirectTo || "/client/login?status=success");
}

export async function clientLogout() {
  await destroyClientSession();
  redirect("/client/login?status=loggedOut");
}
