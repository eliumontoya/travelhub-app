"use server";

import { revalidatePath } from "next/cache";
import {
  deleteClientDocument,
  getClientDocuments,
  updateClient,
  uploadClientDocument,
} from "@/lib/data";

export async function updateClientAction(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await updateClient(clientId, {
    name,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function uploadClientDocumentAction(clientId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadClientDocument(clientId, file);
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function deleteClientDocumentAction(clientId: string, documentId: string) {
  await deleteClientDocument(documentId);
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function getClientDocumentsAction(clientId: string) {
  return getClientDocuments(clientId);
}
