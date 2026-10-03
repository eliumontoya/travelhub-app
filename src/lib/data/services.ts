import { Service, ServiceType } from "@/types";
import { mockServiceChecklistItems, mockServices } from "@/lib/mock-data";
import { isSupabaseConfigured, uid } from "@/lib/data/shared";
import {
  DEFAULT_SERVICE_TYPE,
  getServiceClient,
  nowIso,
} from "@/lib/data/service-shared";

export * from "@/lib/data/service-documents";
export * from "@/lib/data/service-checklist";

export function rowToService(row: Record<string, unknown>): Service {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    clientId: row.client_id as string,
    serviceType: (row.service_type as ServiceType) ?? DEFAULT_SERVICE_TYPE,
    status: (row.status as Service["status"]) ?? "active",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function ensureServiceForAssignment(
  tripId: string,
  clientId: string
): Promise<Service> {
  if (!isSupabaseConfigured()) {
    const existing = mockServices.find(
      (s) =>
        s.tripId === tripId &&
        s.clientId === clientId &&
        s.serviceType === DEFAULT_SERVICE_TYPE
    );
    if (existing) return existing;
    const service: Service = {
      id: uid(),
      tripId,
      clientId,
      serviceType: DEFAULT_SERVICE_TYPE,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockServices.push(service);
    return service;
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .upsert(
      {
        trip_id: tripId,
        client_id: clientId,
        service_type: DEFAULT_SERVICE_TYPE,
        status: "active",
      },
      { onConflict: "trip_id,client_id,service_type" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToService(data);
}

export async function getServiceForClientTrip(
  clientId: string,
  tripId: string
): Promise<Service | null> {
  if (!isSupabaseConfigured()) {
    return (
      mockServices.find(
        (s) =>
          s.clientId === clientId &&
          s.tripId === tripId &&
          s.serviceType === DEFAULT_SERVICE_TYPE
      ) ?? null
    );
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("client_id", clientId)
    .eq("trip_id", tripId)
    .eq("service_type", DEFAULT_SERVICE_TYPE)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToService(data) : null;
}

export async function getServicesForTrip(tripId: string): Promise<Service[]> {
  if (!isSupabaseConfigured()) {
    return mockServices
      .filter((s) => s.tripId === tripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToService);
}

export async function hasOwnedServiceRequirements(
  tripId: string,
  clientId: string
): Promise<boolean> {
  const service = await getServiceForClientTrip(clientId, tripId);
  if (!service) return false;

  if (!isSupabaseConfigured()) {
    return mockServiceChecklistItems.some((item) => item.serviceId === service.id);
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("service_checklist_items")
    .select("id")
    .eq("service_id", service.id)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
