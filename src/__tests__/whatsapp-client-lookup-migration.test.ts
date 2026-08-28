import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readClientWhatsappMigration() {
  const migrationsDir = join(root, "supabase", "migrations");
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith("_clients_whatsapp_lookup.sql"))
    .sort()
    .at(-1);

  expect(migration, "clients WhatsApp lookup migration should exist").toBeDefined();
  return readFileSync(join(migrationsDir, migration!), "utf8");
}

describe("clients WhatsApp lookup migration", () => {
  it("adds a nullable CRM WhatsApp field and backfills blank values from phone", () => {
    const sql = readClientWhatsappMigration();

    expect(sql).toContain("alter table clients");
    expect(sql).toContain("add column if not exists whatsapp text");
    expect(sql).toContain("update clients");
    expect(sql).toContain("set whatsapp = phone");
    expect(sql).toContain("nullif(btrim(whatsapp), '') is null");
    expect(sql).toContain("nullif(btrim(phone), '') is not null");
  });

  it("installs a database trigger that copies phone when whatsapp is blank", () => {
    const sql = readClientWhatsappMigration();

    expect(sql).toContain("create or replace function set_client_whatsapp_from_phone()");
    expect(sql).toContain("returns trigger");
    expect(sql).toContain("new.whatsapp := new.phone");
    expect(sql).toContain("before insert or update on clients");
    expect(sql).toContain("execute function set_client_whatsapp_from_phone()");
  });

  it("indexes normalized WhatsApp lookup without indexing blank values", () => {
    const sql = readClientWhatsappMigration();

    expect(sql).toContain("whatsapp_normalized text");
    expect(sql).toContain("regexp_replace(coalesce(new.whatsapp, ''), '\\D', '', 'g')");
    expect(sql).toContain("create index if not exists idx_clients_whatsapp_normalized");
    expect(sql).toContain("on clients (whatsapp_normalized)");
    expect(sql).toContain("where whatsapp_normalized is not null");
  });
});
