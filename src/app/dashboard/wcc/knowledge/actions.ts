"use server";

import { revalidatePath } from "next/cache";
import {
  createWccKnowledgeEntry,
  updateWccKnowledgeEntry,
  updateWccKnowledgeStatus,
  type WccKnowledgeMutationResult,
} from "@/lib/wcc-knowledge";

const initialResult: WccKnowledgeMutationResult = { ok: false, message: "" };

function inputFromForm(formData: FormData) {
  return {
    topic: formData.get("topic"),
    question: formData.get("question"),
    answer: formData.get("answer"),
    tags: formData.get("tags"),
    source: formData.get("source"),
    status: formData.get("status"),
  };
}

function revalidateKnowledge(entryId?: string) {
  revalidatePath("/dashboard/wcc");
  revalidatePath("/dashboard/wcc/knowledge");
  if (entryId) revalidatePath(`/dashboard/wcc/knowledge/${entryId}`);
}

export async function createKnowledgeAction(
  previousState: WccKnowledgeMutationResult = initialResult,
  formData: FormData
): Promise<WccKnowledgeMutationResult> {
  void previousState;
  const result = await createWccKnowledgeEntry(inputFromForm(formData));
  if (result.ok) revalidateKnowledge(result.entryId);
  return result;
}

export async function updateKnowledgeAction(
  entryId: string,
  previousState: WccKnowledgeMutationResult = initialResult,
  formData: FormData
): Promise<WccKnowledgeMutationResult> {
  void previousState;
  const result = await updateWccKnowledgeEntry(entryId, inputFromForm(formData));
  if (result.ok) revalidateKnowledge(entryId);
  return result;
}

export async function updateKnowledgeStatusAction(
  entryId: string,
  previousState: WccKnowledgeMutationResult = initialResult,
  formData: FormData
): Promise<WccKnowledgeMutationResult> {
  void previousState;
  const result = await updateWccKnowledgeStatus(entryId, formData.get("status"));
  if (result.ok) revalidateKnowledge(entryId);
  return result;
}
