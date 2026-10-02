"use server";

import { revalidatePath } from "next/cache";
import {
  markVisaDocumentProcessed,
  markVisaDocumentReviewed,
  requestVisaDocument,
  requestVisaDocumentReUpload,
  setVisaClients,
  transitionVisaStatus,
  updateVisa,
  uploadVisaDocument,
} from "@/lib/data";
import { requireFeature, requireRole } from "@/lib/auth/roles";
import type { Visa, VisaStatus } from "@/types";

const VALID_VISA_STATUSES: VisaStatus[] = ["pending", "in_progress", "completed"];

function isVisaStatus(value: unknown): value is VisaStatus {
  return typeof value === "string" && (VALID_VISA_STATUSES as string[]).includes(value);
}

/**
 * Server action: persist an editable-field edit on a visa. Status changes are
 * intentionally routed through `transitionVisaStatusAction` — this action MUST
 * NOT accept or forward `status` from the form. Returns an envelope so the
 * client component can render the result without throwing.
 */
export async function updateVisaAction(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; visa?: Visa; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  const country = String(formData.get("country") ?? "").trim();
  const visaType = String(formData.get("visaType") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  if (!country) {
    return { ok: false, error: "Country is required." };
  }
  if (!visaType) {
    return { ok: false, error: "Visa type is required." };
  }
  if (!deadline) {
    return { ok: false, error: "Deadline is required." };
  }
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Price must be a non-negative number." };
  }

  try {
    const visa = await updateVisa(id, {
      country,
      visaType,
      deadline,
      price,
      notes,
    });
    revalidatePath(`/dashboard/visas/${id}`);
    return { ok: true, visa };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update visa.",
    };
  }
}

/**
 * Server action: replace the assigned-client set for a visa. Empty list is
 * allowed and zeros out the assignment.
 */
export async function setVisaClientsAction(
  id: string,
  clientIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  try {
    await setVisaClients(id, clientIds);
    revalidatePath(`/dashboard/visas/${id}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update assigned clients.",
    };
  }
}

/**
 * Server action: advance a visa through its forward-only lifecycle
 * (`pending → in_progress → completed`). The data layer's
 * `transitionVisaStatus` enforces the legal transitions and throws on any
 * backward/skip/terminal attempt; we surface that error so the UI can show it.
 */
export async function transitionVisaStatusAction(
  id: string,
  toStatus: VisaStatus,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  if (!isVisaStatus(toStatus)) {
    return { ok: false, error: `Invalid visa status: ${String(toStatus)}` };
  }

  try {
    await transitionVisaStatus(id, toStatus);
    revalidatePath(`/dashboard/visas/${id}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not transition visa status.",
    };
  }
}

/**
 * Server action: agent uploads a file directly to the visa's document bucket.
 * Used when the agent already has the file on hand (no traveler request
 * required).
 */
export async function uploadVisaDocumentAction(
  visaId: string,
  file: File,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  try {
    await uploadVisaDocument(visaId, file);
    revalidatePath(`/dashboard/visas/${visaId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not upload document.",
    };
  }
}

/**
 * Server action: agent asks an assigned traveler to upload a specific
 * document. The data layer enforces that the traveler is actually assigned
 * to the visa.
 */
export async function requestVisaDocumentAction(
  visaId: string,
  clientId: string,
  description: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  const trimmed = description.trim();
  if (!trimmed) {
    return { ok: false, error: "Description is required." };
  }

  try {
    await requestVisaDocument(visaId, clientId, trimmed);
    revalidatePath(`/dashboard/visas/${visaId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not request document.",
    };
  }
}

/**
 * Server action: mark an `uploaded` visa document as `reviewed` (agent-only).
 */
export async function markVisaDocumentReviewedAction(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  try {
    await markVisaDocumentReviewed(documentId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not mark document as reviewed.",
    };
  }
}

/**
 * Server action: mark a `reviewed` visa document as `processed` (terminal).
 */
export async function markVisaDocumentProcessedAction(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  try {
    await markVisaDocumentProcessed(documentId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not mark document as processed.",
    };
  }
}

/**
 * Server action: ask the assigned traveler to re-upload a document with an
 * agent comment explaining why. The data layer stores the comment on the row.
 */
export async function requestVisaDocumentReUploadAction(
  documentId: string,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  const trimmed = comment.trim();
  if (!trimmed) {
    return { ok: false, error: "Comment is required." };
  }

  try {
    await requestVisaDocumentReUpload(documentId, trimmed);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not request re-upload.",
    };
  }
}
