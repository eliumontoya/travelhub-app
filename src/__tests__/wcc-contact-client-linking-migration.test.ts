import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readLinkingMigration() {
  const migrationsDir = join(root, "supabase", "migrations");
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith("_wcc_contact_client_linking.sql"))
    .sort()
    .at(-1);

  expect(migration, "WCC contact-client linking migration should exist").toBeDefined();
  return readFileSync(join(migrationsDir, migration!), "utf8");
}

describe("WCC contact-client linking migration", () => {
  it("adds provenance columns and a constrained automatic/manual source", () => {
    const sql = readLinkingMigration();

    expect(sql).toContain("add column if not exists linked_client_source text");
    expect(sql).toContain("add column if not exists linked_client_matched_at timestamptz");
    expect(sql).toContain("whatsapp_contacts_linked_client_source_check");
    expect(sql).toContain("linked_client_source in ('auto_phone', 'manual')");
  });

  it("resolves only exact unique normalized WhatsApp matches", () => {
    const sql = readLinkingMigration();

    expect(sql).toContain("create or replace function normalize_whatsapp_phone(phone text)");
    expect(sql).toContain("regexp_replace(coalesce(phone, ''), '\\D', '', 'g')");
    expect(sql).toContain("create or replace function resolve_whatsapp_contact_client_id(phone text)");
    expect(sql).toContain("where whatsapp_normalized = normalized_phone");
    expect(sql).toContain("if match_count = 1 then");
    expect(sql).toContain("return null");
  });

  it("maintains links from contact and client change triggers", () => {
    const sql = readLinkingMigration();

    expect(sql).toContain("create trigger whatsapp_contacts_set_linked_client");
    expect(sql).toContain("before insert or update of phone_e164, linked_client_id, linked_client_source on whatsapp_contacts");
    expect(sql).toContain("create trigger clients_refresh_whatsapp_contact_links");
    expect(sql).toContain("after insert or update of whatsapp_normalized on clients");
    expect(sql).toContain("set phone_e164 = phone_e164");
  });

  it("preserves manual links and backfills only unlinked unique matches", () => {
    const sql = readLinkingMigration();

    expect(sql).toContain("coalesce(new.linked_client_source, 'manual') <> 'auto_phone'");
    expect(sql).toContain("set linked_client_source = 'manual'");
    expect(sql).toContain("where linked_client_id is not null");
    expect(sql).toContain("where contact.linked_client_id is null");
    expect(sql).toContain("having count(*) = 1");
    expect(sql).toContain("linked_client_source = 'auto_phone'");
  });
});
