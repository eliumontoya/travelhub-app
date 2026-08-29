import { createClient, isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
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

async function count(query: Query) {
  const result = (await query.select("id", { count: "exact", head: true })) as Result;
  if (result.error) throw new Error(result.error.message ?? "WCC count failed");
  return result.count ?? 0;
}

async function recent<T>(query: Query, columns: string) {
  const result = (await query.select(columns).order("last_message_at", { ascending: false }).range(0, 4)) as Result<T>;
  if (result.error) throw new Error(result.error.message ?? "WCC rows failed");
  return result.data ?? [];
}

export async function getWccDashboardSummary(): Promise<WccDashboardSummary> {
  if (!hasSupabaseConfig()) return emptySummary();

  try {
    const db = (await createClient()) as unknown as Client;
    const [openEscalations, recentConversationCount, recentContactCount, pendingMessageCount, failedMessageCount, draft, approved, archived, conversations, contacts] = await Promise.all([
      count(db.from("whatsapp_escalations").eq("status", "open")),
      count(db.from("whatsapp_conversations")),
      count(db.from("whatsapp_contacts")),
      count(db.from("whatsapp_messages").in("status", ["received", "processed"])),
      count(db.from("whatsapp_messages").eq("status", "failed")),
      count(db.from("whatsapp_knowledge_entries").eq("status", "draft")),
      count(db.from("whatsapp_knowledge_entries").eq("status", "approved")),
      count(db.from("whatsapp_knowledge_entries").eq("status", "archived")),
      recent<Record<string, unknown>>(db.from("whatsapp_conversations"), "id, status, last_intent, last_message_at"),
      recent<Record<string, unknown>>(db.from("whatsapp_contacts"), "id, display_name, whatsapp_profile_name, phone_e164, last_message_at"),
    ]);

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      openEscalations,
      recentConversationCount,
      recentContactCount,
      pendingMessageCount,
      failedMessageCount,
      knowledgeByStatus: { draft, approved, archived },
      recentConversations: conversations.map((row) => ({
        id: row.id as string,
        status: row.status as WhatsAppConversationStatus,
        lastIntent: (row.last_intent as string | null) ?? undefined,
        lastMessageAt: (row.last_message_at as string | null) ?? undefined,
      })),
      recentContacts: contacts.map((row) => ({
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
