import { isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
import { createWccClient } from "@/lib/wcc-client";
import type { WhatsAppConversationStatus, WhatsAppKnowledgeStatus } from "@/types";

export type WccRecentConversation = {
  id: string;
  status: WhatsAppConversationStatus;
  lastIntent?: string;
  lastMessageAt?: string;
};
export type WccRecentContact = {
  id: string;
  displayName?: string;
  phoneE164: string;
  lastMessageAt?: string;
};
export type WccDashboardSummary = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  openEscalations: number;
  recentConversationCount: number;
  recentContactCount: number;
  pendingMessageCount: number;
  failedMessageCount: number;
  knowledgeByStatus: Record<WhatsAppKnowledgeStatus, number>;
  recentConversations: WccRecentConversation[];
  recentContacts: WccRecentContact[];
};

type Query = {
  select: (...args: unknown[]) => Query;
  eq: (...args: unknown[]) => Query;
  in: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  range: (...args: unknown[]) => Promise<unknown>;
};
type Client = { from: (table: string) => Query };
type Result<T = unknown> = { data?: T[] | null; error?: { message?: string } | null; count?: number | null };

const emptyKnowledge = { draft: 0, approved: 0, archived: 0 };
export const wccKnowledgeStatuses: WhatsAppKnowledgeStatus[] = ["draft", "approved", "archived"];

function emptySummary(overrides: Partial<WccDashboardSummary> = {}): WccDashboardSummary {
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    openEscalations: 0,
    recentConversationCount: 0,
    recentContactCount: 0,
    pendingMessageCount: 0,
    failedMessageCount: 0,
    knowledgeByStatus: emptyKnowledge,
    recentConversations: [],
    recentContacts: [],
    ...overrides,
  };
}

async function count(db: Client, table: string, applyFilter?: (query: Query) => Query) {
  const baseQuery = db.from(table).select("id", { count: "exact", head: true });
  const result = (await (applyFilter ? applyFilter(baseQuery) : baseQuery)) as Result;
  if (result.error) throw new Error(result.error.message ?? "WCC count failed");
  return result.count ?? 0;
}

async function recent<T>(query: Query, columns: string) {
  const result = (await query.select(columns).order("last_message_at", { ascending: false }).range(0, 4)) as Result<T>;
  if (result.error) throw new Error(result.error.message ?? "WCC rows failed");
  return result.data ?? [];
}

async function safeRead<T>(read: () => Promise<T>, fallback: T) {
  try {
    return { value: await read(), failed: false };
  } catch {
    return { value: fallback, failed: true };
  }
}

export async function getWccDashboardSummary(): Promise<WccDashboardSummary> {
  if (!hasSupabaseConfig()) return emptySummary();

  try {
    const db = (await createWccClient()) as unknown as Client;
    const [openEscalations, recentConversationCount, recentContactCount, pendingMessageCount, failedMessageCount, draft, approved, archived, conversations, contacts] = await Promise.all([
      safeRead(() => count(db, "whatsapp_escalations", (query) => query.eq("status", "open")), 0),
      safeRead(() => count(db, "whatsapp_conversations"), 0),
      safeRead(() => count(db, "whatsapp_contacts"), 0),
      safeRead(() => count(db, "whatsapp_messages", (query) => query.in("status", ["received", "processed"])), 0),
      safeRead(() => count(db, "whatsapp_messages", (query) => query.eq("status", "failed")), 0),
      safeRead(() => count(db, "whatsapp_knowledge_entries", (query) => query.eq("status", "draft")), 0),
      safeRead(() => count(db, "whatsapp_knowledge_entries", (query) => query.eq("status", "approved")), 0),
      safeRead(() => count(db, "whatsapp_knowledge_entries", (query) => query.eq("status", "archived")), 0),
      safeRead(() => recent<Record<string, unknown>>(db.from("whatsapp_conversations"), "id, status, last_intent, last_message_at"), []),
      safeRead(() => recent<Record<string, unknown>>(db.from("whatsapp_contacts"), "id, display_name, whatsapp_profile_name, phone_e164, last_message_at"), []),
    ]);

    const readsFailed = [openEscalations, recentConversationCount, recentContactCount, pendingMessageCount, failedMessageCount, draft, approved, archived, conversations, contacts].some((read) => read.failed);

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: readsFailed,
      openEscalations: openEscalations.value,
      recentConversationCount: recentConversationCount.value,
      recentContactCount: recentContactCount.value,
      pendingMessageCount: pendingMessageCount.value,
      failedMessageCount: failedMessageCount.value,
      knowledgeByStatus: { draft: draft.value, approved: approved.value, archived: archived.value },
      recentConversations: conversations.value.map((row) => ({
        id: row.id as string,
        status: row.status as WhatsAppConversationStatus,
        lastIntent: (row.last_intent as string | null) ?? undefined,
        lastMessageAt: (row.last_message_at as string | null) ?? undefined,
      })),
      recentContacts: contacts.value.map((row) => ({
        id: row.id as string,
        displayName: ((row.display_name as string | null) ?? (row.whatsapp_profile_name as string | null)) ?? undefined,
        phoneE164: row.phone_e164 as string,
        lastMessageAt: (row.last_message_at as string | null) ?? undefined,
      })),
    };
  } catch {
    return emptySummary({ isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}
