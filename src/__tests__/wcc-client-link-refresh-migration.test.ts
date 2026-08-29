import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith("_fix_wcc_client_link_refresh.sql"))
    .sort()
    .at(-1);

  expect(migration, "client link refresh fix migration should exist").toBeDefined();
  return readFileSync(join(migrationsDir, migration!), "utf8");
}

describe("WCC client link refresh fix migration", () => {
  it("updates eligible contacts directly from the client trigger", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function refresh_whatsapp_contact_links_for_client()");
    expect(sql).toContain("update whatsapp_contacts as contact");
    expect(sql).toContain("resolve_whatsapp_contact_client_id(phone_e164) as client_id");
    expect(sql).toContain("where contact.id = resolved.id");
    expect(sql).not.toContain("set phone_e164 = phone_e164");
  });

  it("preserves manual links and clears auto links when matches disappear or become ambiguous", () => {
    const sql = readMigration();

    expect(sql).toContain("linked_client_id is null or linked_client_source = 'auto_phone'");
    expect(sql).toContain("linked_client_source = case when resolved.client_id is null then null else 'auto_phone' end");
    expect(sql).toContain("linked_client_matched_at = case when resolved.client_id is null then null else now() end");
  });

  it("fires for client insert and visible WhatsApp/phone updates", () => {
    const sql = readMigration();

    expect(sql).toContain("drop trigger if exists clients_refresh_whatsapp_contact_links on clients");
    expect(sql).toContain("after insert or update of phone, whatsapp, whatsapp_normalized on clients");
    expect(sql).toContain("execute function refresh_whatsapp_contact_links_for_client()");
  });
});
