import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readInboundMigration() {
  const migrationsDir = join(root, "supabase", "migrations");
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith("_whatsapp_inbound_data_foundation.sql"))
    .sort()
    .at(-1);

  expect(migration, "WhatsApp inbound migration should exist").toBeDefined();
  return readFileSync(join(migrationsDir, migration!), "utf8");
}

describe("WhatsApp inbound data foundation migration", () => {
  it("creates the required WhatsApp and CRM staging tables", () => {
    const sql = readInboundMigration();

    for (const table of [
      "whatsapp_contacts",
      "whatsapp_conversations",
      "whatsapp_messages",
      "whatsapp_intents",
      "whatsapp_escalations",
      "whatsapp_knowledge_entries",
      "crm_sync_events",
    ]) {
      expect(sql).toContain(`create table if not exists ${table}`);
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`alter table ${table} force row level security`);
      expect(sql).toContain(`revoke all on ${table} from anon`);
      expect(sql).toContain(`grant select, insert, update, delete on ${table} to authenticated`);
    }
  });

  it("defines key constraints and indexes for idempotency and queue polling", () => {
    const sql = readInboundMigration();

    expect(sql).toContain("phone_e164 text not null unique");
    expect(sql).toContain("whatsapp_message_id text not null unique");
    expect(sql).toContain("create unique index if not exists idx_crm_sync_events_event_key");
    expect(sql).toContain("create index if not exists idx_crm_sync_events_pending");
    expect(sql).toContain("where status = 'pending'");
    expect(sql).toContain("check (status in ('pending', 'processing', 'processed', 'failed'))");
  });
});

describe("WhatsApp inbound TypeScript contracts", () => {
  it("exports domain interfaces and status unions", () => {
    const types = readFileSync(join(root, "src", "types", "index.ts"), "utf8");

    for (const exportName of [
      "WhatsAppContact",
      "WhatsAppConversation",
      "WhatsAppMessage",
      "WhatsAppIntent",
      "WhatsAppEscalation",
      "WhatsAppKnowledgeEntry",
      "CrmSyncEvent",
      "CrmSyncEventStatus",
    ]) {
      expect(types).toContain(exportName);
    }
  });
});
