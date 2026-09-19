import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260918_traveler_activities.sql");

async function readMigration() {
  return readFile(migrationPath, "utf8");
}

describe("traveler activity migration contract", () => {
  it("limits RPC execution to service_role and preserves anonymous reads", async () => {
    const migration = await readMigration();

    for (const functionName of [
      "create_traveler_activity",
      "update_traveler_activity",
      "soft_delete_traveler_activity",
    ]) {
      expect(migration).toContain(`revoke all on function ${functionName}`);
      expect(migration).toContain(`grant execute on function ${functionName}`);
    }
    expect(migration).toContain("from public, anon, authenticated;");
    expect(migration).toContain("to service_role;");
  });

  it("locks and revalidates published lifecycle, assignment, active day, and active ownership", async () => {
    const migration = await readMigration();

    expect(migration).toContain("for update;");
    expect(migration).toContain("for key share;");
    expect(migration).toContain("v_trip.status <> 'published'");
    expect(migration).toContain("trip_id = p_trip_id and client_id = p_client_id");
    expect(migration).toContain("id = p_trip_day_id and trip_id = p_trip_id and deleted_at is null");
    expect(migration).toContain("type = 'activity'");
    expect(migration).toContain("created_by_client_id = p_client_id");
  });
});
