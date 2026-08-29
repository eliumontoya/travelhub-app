import { isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
import { createWccClient } from "@/lib/wcc-client";
import type { WhatsAppKnowledgeEntry, WhatsAppKnowledgeStatus } from "@/types";

export const WCC_KNOWLEDGE_PAGE_SIZE = 20;
export const wccKnowledgeStatuses: WhatsAppKnowledgeStatus[] = ["draft", "approved", "archived"];

export type WccKnowledgeListFilters = {
  page?: number | string;
  status?: string;
};

export type WccKnowledgeList = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  entries: WhatsAppKnowledgeEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  status?: WhatsAppKnowledgeStatus;
};

export type WccKnowledgeDetail = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  entry?: WhatsAppKnowledgeEntry;
};

export type WccKnowledgeMutationResult = {
  ok: boolean;
  message: string;
  entryId?: string;
  errors?: Partial<Record<"id" | "topic" | "question" | "answer" | "tags" | "source" | "status", string>>;
};

export type WccKnowledgeInput = {
  topic: unknown;
  question: unknown;
  answer: unknown;
  tags?: unknown;
  source?: unknown;
  status: unknown;
};

type RecordRow = Record<string, unknown>;
type MultiResult<T = unknown> = { data?: T[] | null; error?: { message?: string } | null; count?: number | null };
type SingleResult<T = unknown> = { data?: T | null; error?: { message?: string } | null };
type Query = PromiseLike<MultiResult> & {
  select: (...args: unknown[]) => Query;
  eq: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  range: (...args: unknown[]) => Query;
  insert: (...args: unknown[]) => Query;
  update: (...args: unknown[]) => Query;
  maybeSingle: () => Promise<SingleResult>;
  single: () => Promise<SingleResult>;
};
type DbClient = { from: (table: string) => Query };

export class WccKnowledgeValidationError extends Error {
  errors: NonNullable<WccKnowledgeMutationResult["errors"]>;

  constructor(errors: NonNullable<WccKnowledgeMutationResult["errors"]>) {
    super("Knowledge entry validation failed");
    this.name = "WccKnowledgeValidationError";
    this.errors = errors;
  }
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizePage(page: unknown) {
  const numeric = typeof page === "number" ? page : Number(page ?? 1);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
}

export function normalizeWccKnowledgeStatus(status: unknown): WhatsAppKnowledgeStatus | undefined {
  return typeof status === "string" && wccKnowledgeStatuses.includes(status as WhatsAppKnowledgeStatus) ? (status as WhatsAppKnowledgeStatus) : undefined;
}

function emptyList(filters: WccKnowledgeListFilters = {}, overrides: Partial<WccKnowledgeList> = {}): WccKnowledgeList {
  const page = normalizePage(filters.page);
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    entries: [],
    page,
    pageSize: WCC_KNOWLEDGE_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    status: normalizeWccKnowledgeStatus(filters.status),
    ...overrides,
  };
}

function emptyDetail(overrides: Partial<WccKnowledgeDetail> = {}): WccKnowledgeDetail {
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    ...overrides,
  };
}

function mapEntry(row: RecordRow): WhatsAppKnowledgeEntry {
  return {
    id: row.id as string,
    topic: row.topic as string,
    question: row.question as string,
    answer: row.answer as string,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    source: stringOrUndefined(row.source),
    status: row.status as WhatsAppKnowledgeStatus,
    approvedAt: stringOrUndefined(row.approved_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function runRows<T>(query: Query, fallback: string) {
  const result = (await query) as MultiResult<T>;
  if (result.error) throw new Error(result.error.message ?? fallback);
  return result;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: unknown) {
  const raw = Array.isArray(value) ? value.join(",") : readString(value);
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function validateWccKnowledgeInput(input: WccKnowledgeInput) {
  const topic = readString(input.topic);
  const question = readString(input.question);
  const answer = readString(input.answer);
  const source = readString(input.source);
  const tags = normalizeTags(input.tags);
  const status = normalizeWccKnowledgeStatus(input.status);
  const errors: NonNullable<WccKnowledgeMutationResult["errors"]> = {};

  if (!topic) errors.topic = "El tema es obligatorio.";
  else if (topic.length > 120) errors.topic = "El tema debe tener máximo 120 caracteres.";

  if (!question) errors.question = "La pregunta es obligatoria.";
  else if (question.length > 500) errors.question = "La pregunta debe tener máximo 500 caracteres.";

  if (!answer) errors.answer = "La respuesta es obligatoria.";
  else if (answer.length > 4000) errors.answer = "La respuesta debe tener máximo 4000 caracteres.";

  if (source.length > 300) errors.source = "La fuente debe tener máximo 300 caracteres.";
  if (tags.length > 12) errors.tags = "Usa máximo 12 tags.";
  else if (tags.some((tag) => tag.length > 40)) errors.tags = "Cada tag debe tener máximo 40 caracteres.";

  if (!status) errors.status = "El estado no es válido.";

  if (Object.keys(errors).length > 0 || !status) throw new WccKnowledgeValidationError(errors);

  return {
    topic,
    question,
    answer,
    tags,
    source: source || null,
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  };
}

export async function getWccKnowledgeList(filters: WccKnowledgeListFilters = {}): Promise<WccKnowledgeList> {
  const page = normalizePage(filters.page);
  const status = normalizeWccKnowledgeStatus(filters.status);
  if (!hasSupabaseConfig()) return emptyList({ ...filters, page });

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const from = (page - 1) * WCC_KNOWLEDGE_PAGE_SIZE;
    const to = from + WCC_KNOWLEDGE_PAGE_SIZE - 1;
    let query = db
      .from("whatsapp_knowledge_entries")
      .select("id, topic, question, answer, tags, source, status, approved_at, created_at, updated_at", { count: "exact" });
    if (status) query = query.eq("status", status);
    const result = await runRows<RecordRow>(
      query.order("updated_at", { ascending: false }).order("created_at", { ascending: false }).range(from, to),
      "Could not read WhatsApp knowledge entries"
    );
    const rows = result.data ?? [];
    const totalCount = result.count ?? rows.length;

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      entries: rows.map(mapEntry),
      page,
      pageSize: WCC_KNOWLEDGE_PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / WCC_KNOWLEDGE_PAGE_SIZE),
      status,
    };
  } catch {
    return emptyList({ ...filters, page }, { isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

export async function getWccKnowledgeEntry(entryId: string): Promise<WccKnowledgeDetail> {
  if (!hasSupabaseConfig()) return emptyDetail();
  if (!entryId.trim()) return emptyDetail({ isSupabaseConfigured: true });

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const result = (await db
      .from("whatsapp_knowledge_entries")
      .select("id, topic, question, answer, tags, source, status, approved_at, created_at, updated_at")
      .eq("id", entryId)
      .maybeSingle()) as SingleResult<RecordRow>;

    if (result.error) throw new Error(result.error.message ?? "Could not read WhatsApp knowledge entry");
    return emptyDetail({ isSupabaseConfigured: true, entry: result.data ? mapEntry(result.data) : undefined });
  } catch {
    return emptyDetail({ isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

function unavailableMutation(): WccKnowledgeMutationResult {
  return { ok: false, message: "Configura Supabase para administrar knowledge de WhatsApp." };
}

function validationResult(error: WccKnowledgeValidationError): WccKnowledgeMutationResult {
  return { ok: false, message: "Revisa los campos marcados.", errors: error.errors };
}

export async function createWccKnowledgeEntry(input: WccKnowledgeInput): Promise<WccKnowledgeMutationResult> {
  if (!hasSupabaseConfig()) return unavailableMutation();

  let payload: ReturnType<typeof validateWccKnowledgeInput>;
  try {
    payload = validateWccKnowledgeInput(input);
  } catch (error) {
    if (error instanceof WccKnowledgeValidationError) return validationResult(error);
    throw error;
  }

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const result = (await db.from("whatsapp_knowledge_entries").insert(payload).select("id").single()) as SingleResult<{ id: string }>;
    if (result.error || !result.data?.id) return { ok: false, message: result.error?.message ?? "No se pudo crear la entrada." };
    return { ok: true, message: "Knowledge creado.", entryId: result.data.id };
  } catch {
    return { ok: false, message: "No se pudo crear la entrada." };
  }
}

export async function updateWccKnowledgeEntry(entryId: string, input: WccKnowledgeInput): Promise<WccKnowledgeMutationResult> {
  if (!hasSupabaseConfig()) return unavailableMutation();
  if (!entryId.trim()) return { ok: false, message: "La entrada no es válida.", errors: { id: "La entrada no es válida." } };

  let payload: ReturnType<typeof validateWccKnowledgeInput>;
  try {
    payload = validateWccKnowledgeInput(input);
  } catch (error) {
    if (error instanceof WccKnowledgeValidationError) return validationResult(error);
    throw error;
  }

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const result = (await db.from("whatsapp_knowledge_entries").update(payload).eq("id", entryId).select("id").single()) as SingleResult<{ id: string }>;
    if (result.error || !result.data?.id) return { ok: false, message: result.error?.message ?? "No se pudo actualizar la entrada." };
    return { ok: true, message: "Knowledge actualizado.", entryId: result.data.id };
  } catch {
    return { ok: false, message: "No se pudo actualizar la entrada." };
  }
}

export async function updateWccKnowledgeStatus(entryId: string, statusInput: unknown): Promise<WccKnowledgeMutationResult> {
  if (!hasSupabaseConfig()) return unavailableMutation();
  if (!entryId.trim()) return { ok: false, message: "La entrada no es válida.", errors: { id: "La entrada no es válida." } };
  const status = normalizeWccKnowledgeStatus(statusInput);
  if (!status) return { ok: false, message: "El estado no es válido.", errors: { status: "El estado no es válido." } };

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const result = (await db
      .from("whatsapp_knowledge_entries")
      .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
      .eq("id", entryId)
      .select("id")
      .single()) as SingleResult<{ id: string }>;
    if (result.error || !result.data?.id) return { ok: false, message: result.error?.message ?? "No se pudo cambiar el estado." };
    return { ok: true, message: `Estado cambiado a ${status}.`, entryId: result.data.id };
  } catch {
    return { ok: false, message: "No se pudo cambiar el estado." };
  }
}
