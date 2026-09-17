import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20260916170000_account_profiles.sql");

describe("account profiles migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("creates the profiles table", () => {
    expect(sql).toMatch(/create table if not exists profiles/i);
    expect(sql).toMatch(/id uuid primary key references auth\.users\(id\)/i);
    expect(sql).toMatch(/role text not null check \(role in \('admin', 'agent'\)\)/i);
    expect(sql).toMatch(/features text\[\] not null default '\{\}'/i);
    expect(sql).toMatch(/travel_agent_id uuid references travel_agents\(id\) on delete set null/i);
  });

  it("links profiles to auth.users with cascading delete", () => {
    expect(sql).toMatch(/references auth\.users\(id\) on delete cascade/i);
  });

  it("enables row level security", () => {
    expect(sql).toMatch(/alter table profiles enable row level security/i);
    expect(sql).toMatch(/alter table profiles force row level security/i);
  });

  it("defines a self-read policy", () => {
    expect(sql).toMatch(/profiles_self_read/i);
    expect(sql).toMatch(/auth\.uid\(\) = id/i);
  });

  it("defines an admin-read-all policy", () => {
    expect(sql).toMatch(/profiles_admin_read_all/i);
    expect(sql).toMatch(/role = 'admin'/i);
  });

  it("grants only select to authenticated users", () => {
    expect(sql).toMatch(/grant select on profiles to authenticated/i);
    expect(sql).not.toMatch(/grant insert on profiles to authenticated/i);
    expect(sql).not.toMatch(/grant update on profiles to authenticated/i);
    expect(sql).not.toMatch(/grant delete on profiles to authenticated/i);
  });
});
