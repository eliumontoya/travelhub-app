import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cascade behavior for the trip/service assignment flow, proven against the
 * local Supabase stack (migration pattern "b" — see helpers/db.ts).
 *
 * `@/lib/supabase/server` is mocked so the production code path runs against
 * the real local client (service role): `isSupabaseConfigured()` is true and
 * both the cookie-less server client and the admin client resolve to the same
 * local instance. Each test creates its own client/trip rows with a
 * `phase2-batch3` marker so seed rows are never touched, and cleans up after
 * itself through the service client.
 */
vi.mock("@/lib/supabase/server", async () => {
  const { getTestSupabaseClient } = await import("@/lib/__tests__/helpers/db");
  const client = getTestSupabaseClient();
  return {
    isSupabaseConfigured: () => true,
    createClient: async () => client,
    getSupabaseAdmin: () => client,
  };
});

import { getTestSupabaseClient } from "@/lib/__tests__/helpers/db";
import { createClient } from "@/lib/data/clients";
import { createTrip, deleteTrip, setTripClients } from "@/lib/data/trips";
import { addChecklistItem, uploadServiceDocument } from "@/lib/data/services";

const DOCUMENTS_BUCKET = "trip-documents";
const MARKER = "phase2-batch3";
const service = getTestSupabaseClient();
const createdTripIds: string[] = [];
const createdClientIds: string[] = [];
const uploadedPaths: string[] = [];

function unique(label: string): string {
  return `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function makeClient(label: string) {
  const client = await createClient({ name: `${MARKER} ${label} ${unique(label)}` });
  createdClientIds.push(client.id);
  return client;
}

async function makeTrip(clientIds: string[], label: string) {
  const trip = await createTrip({
    clientIds,
    title: `${MARKER} ${label}`,
    slug: `${MARKER}-${unique(label)}`,
  });
  createdTripIds.push(trip.id);
  return trip;
}

async function serviceIdsForTrip(tripId: string): Promise<string[]> {
  const { data, error } = await service.from("services").select("id").eq("trip_id", tripId);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

async function serviceForClient(tripId: string, clientId: string): Promise<string> {
  const { data, error } = await service
    .from("services")
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_id", clientId)
    .single();
  if (error) throw error;
  return data.id as string;
}

async function countRows(tableName: string, column: string, value: string): Promise<number> {
  const { count, error } = await service
    .from(tableName)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

/** Removes any rows left behind by a previously interrupted run. */
async function purgeMarkedRows(): Promise<void> {
  const { data: leftoverTrips } = await service
    .from("trips")
    .select("id")
    .like("slug", `${MARKER}-%`);
  const tripIds = (leftoverTrips ?? []).map((row) => row.id as string);
  if (tripIds.length) await service.from("trips").delete().in("id", tripIds);

  const { data: leftoverClients } = await service
    .from("clients")
    .select("id")
    .like("name", `${MARKER} %`);
  const clientIds = (leftoverClients ?? []).map((row) => row.id as string);
  if (clientIds.length) await service.from("clients").delete().in("id", clientIds);
}

beforeEach(purgeMarkedRows);

afterEach(async () => {
  if (uploadedPaths.length) {
    await service.storage.from(DOCUMENTS_BUCKET).remove([...uploadedPaths]);
    uploadedPaths.length = 0;
  }
  if (createdTripIds.length) {
    await service.from("trips").delete().in("id", [...createdTripIds]);
    createdTripIds.length = 0;
  }
  if (createdClientIds.length) {
    await service.from("clients").delete().in("id", [...createdClientIds]);
    createdClientIds.length = 0;
  }
});

describe("auto-create (real local DB)", () => {
  it("createTrip auto-creates one service per assigned client", async () => {
    const a = await makeClient("client-a");
    const b = await makeClient("client-b");

    const trip = await makeTrip([a.id, b.id], "auto-create");

    const { data: services, error } = await service
      .from("services")
      .select("id, client_id, service_type, status")
      .eq("trip_id", trip.id);
    expect(error).toBeNull();
    expect(services).toHaveLength(2);
    expect(services!.map((row) => row.client_id).sort()).toEqual([a.id, b.id].sort());
    expect(
      services!.every((row) => row.service_type === "trip_documents" && row.status === "active")
    ).toBe(true);
    expect(new Set(services!.map((row) => row.id)).size).toBe(2);
  });

  it("setTripClients toAdd auto-creates a service for the new client", async () => {
    const a = await makeClient("add-a");
    const b = await makeClient("add-b");
    const trip = await makeTrip([a.id], "add");

    await setTripClients(trip.id, [a.id, b.id]);

    const services = await serviceIdsForTrip(trip.id);
    expect(services).toHaveLength(2);
    expect(await serviceForClient(trip.id, b.id)).toBeTruthy();
  });

  it("setTripClients removal deletes the removed client's service, checklist items and uploads", async () => {
    const a = await makeClient("remove-a");
    const b = await makeClient("remove-b");
    const trip = await makeTrip([a.id, b.id], "remove");
    const bServiceId = await serviceForClient(trip.id, b.id);

    const item = await addChecklistItem(bServiceId, { label: "Passport", required: true });
    const upload = await uploadServiceDocument(
      bServiceId,
      item.id,
      new File(["x"], "passport.pdf", { type: "application/pdf" })
    );
    uploadedPaths.push(upload.filePath);

    expect(await countRows("service_checklist_items", "service_id", bServiceId)).toBe(1);
    expect(await countRows("service_uploads", "service_id", bServiceId)).toBe(1);

    await setTripClients(trip.id, [a.id]);

    const { data: remaining, error } = await service
      .from("services")
      .select("id, client_id")
      .eq("trip_id", trip.id);
    expect(error).toBeNull();
    expect(remaining).toHaveLength(1);
    expect(remaining![0].client_id).toBe(a.id);
    expect(await countRows("service_checklist_items", "service_id", bServiceId)).toBe(0);
    expect(await countRows("service_uploads", "service_id", bServiceId)).toBe(0);
  });

  it("setTripClients re-assignment is idempotent (no duplicate services)", async () => {
    const a = await makeClient("idempotent-a");
    const b = await makeClient("idempotent-b");
    const trip = await makeTrip([a.id], "idempotent");
    const originalServiceId = await serviceForClient(trip.id, a.id);

    await setTripClients(trip.id, [a.id, b.id]);
    const afterAdd = (await serviceIdsForTrip(trip.id)).length;

    await setTripClients(trip.id, [a.id, b.id]);

    expect(await serviceIdsForTrip(trip.id)).toHaveLength(afterAdd);
    expect(await serviceForClient(trip.id, a.id)).toBe(originalServiceId);
  });

  it("deleteTrip cascades services, checklist items and uploads, and removes storage objects", async () => {
    const a = await makeClient("delete-a");
    const trip = await makeTrip([a.id], "delete");
    const serviceId = await serviceForClient(trip.id, a.id);

    const item = await addChecklistItem(serviceId, { label: "Passport", required: true });
    const upload = await uploadServiceDocument(
      serviceId,
      item.id,
      new File(["x"], "passport.pdf", { type: "application/pdf" })
    );
    uploadedPaths.push(upload.filePath);
    expect(upload.filePath).toContain("services/");

    await deleteTrip(trip.id);

    expect(await countRows("trips", "id", trip.id)).toBe(0);
    expect(await countRows("services", "trip_id", trip.id)).toBe(0);
    expect(await countRows("service_checklist_items", "service_id", serviceId)).toBe(0);
    expect(await countRows("service_uploads", "service_id", serviceId)).toBe(0);

    const folder = upload.filePath.slice(0, upload.filePath.lastIndexOf("/"));
    const { data: listed, error } = await service.storage.from(DOCUMENTS_BUCKET).list(folder);
    expect(error).toBeNull();
    expect(listed ?? []).toHaveLength(0);
  });
});
