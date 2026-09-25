import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260924000000_profiles_admin_update.sql",
);

describe("profiles admin update migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("defines the is_admin_account() SECURITY DEFINER helper", () => {
    expect(sql).toMatch(/create or replace function public\.is_admin_account\(\)/i);
    expect(sql).toMatch(/returns boolean/i);
    expect(sql).toMatch(/language sql/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/stable/i);
    expect(sql).toMatch(/set search_path\s*=\s*public,\s*pg_temp/i);
    expect(sql).toMatch(/set row_security\s*=\s*off/i);
  });

  it("queries profiles inside is_admin_account() without re-entering RLS", () => {
    // The helper must read from public.profiles filtered by auth.uid() and role = 'admin'.
    expect(sql).toMatch(/from public\.profiles/i);
    expect(sql).toMatch(/auth\.uid\(\)/i);
    expect(sql).toMatch(/role\s*=\s*'admin'/i);
  });

  it("re-creates the admin read-all policy using the helper", () => {
    expect(sql).toMatch(/create policy "profiles_admin_read_all" on profiles/i);
    expect(sql).toMatch(/for\s+select\s+to\s+authenticated/i);
    expect(sql).toMatch(/using\s*\(public\.is_admin_account\(\)\)/i);
  });

  it("creates an admin-only update policy with both using and with check", () => {
    expect(sql).toMatch(/create policy "profiles_admin_update_features" on profiles/i);
    expect(sql).toMatch(/for\s+update\s+to\s+authenticated/i);
    expect(sql).toMatch(/using\s*\(public\.is_admin_account\(\)\)/i);
    expect(sql).toMatch(/with\s+check\s*\(public\.is_admin_account\(\)\)/i);
  });

  it("grants update only on the features and updated_at columns to authenticated", () => {
    expect(sql).toMatch(
      /grant\s+update\s*\(\s*features\s*,\s*updated_at\s*\)\s+on\s+profiles\s+to\s+authenticated/i,
    );
  });

  it("does NOT grant broad update on profiles to authenticated (threat case a)", () => {
    // A bare `grant update on profiles` (no column list) would let authenticated
    // touch any column; the migration must only have the column-scoped grant.
    expect(sql).not.toMatch(/grant update on profiles to authenticated/i);
  });

  it("does NOT grant update on profiles to anon (threat case a)", () => {
    expect(sql).not.toMatch(/grant update on profiles to anon/i);
  });

  it("does NOT grant update on any specific column to anon", () => {
    expect(sql).not.toMatch(/grant update\(.*\) on profiles to anon/i);
  });
});
