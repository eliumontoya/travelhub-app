"use server";

import { revalidatePath } from "next/cache";
import { getClientSession } from "@/lib/client-auth";
import { getVisaById, uploadVisaDocumentForRequest } from "@/lib/data";

/**
 * Server action: traveler uploads a file for a visa document that was
 * requested (or re-upload requested) for them. The page knows the visaId
 * (from `/client/visas/[id]/documents`) and binds it into the form so the
 * action can verify the caller is in the visa's assigned clients before
 * delegating to the data layer. The data layer additionally enforces
 * `document.targetClientId === clientId` and the upload-allowed status
 * guard (`requested` or `re_upload_requested`).
 */
export async function uploadVisaDocumentForRequestAction(
  visaId: string,
  documentId: string,
  formData: FormData,
): Promise<void> {
  const session = await getClientSession();
  if (!session) {
    throw new Error("Session required");
  }

  const visa = await getVisaById(visaId);
  if (!visa) {
    throw new Error("Visa not found");
  }
  const isAssigned = visa.clients.some((c) => c.id === session.clientId);
  if (!isAssigned) {
    throw new Error(
      `Client ${session.clientId} is not assigned to visa ${visa.id}`,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file selected");
  }

  await uploadVisaDocumentForRequest(documentId, session.clientId, file);
  revalidatePath(`/client/visas/${visa.id}/documents`);
}
