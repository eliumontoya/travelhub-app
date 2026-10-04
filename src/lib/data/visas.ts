import { Client, Visa, VisaFilters, VisaStatus, VisaStatusHistoryEntry, VisaWithDetails } from "@/types";
import {
  PaginationParams,
  PaginatedResult,
  canUseServiceRole,
  createServerSupabase,
  paginationBounds,
} from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rowToClient } from "@/lib/data/clients";

export type CreateVisaInput = {
  country: string;
  visaType: string;
  deadline: string;
  price: number;
  notes?: string;
  clientIds?: string[];
};

export type UpdateVisaInput = {
  country?: string;
  visaType?: string;
  deadline?: string;
  price?: number;
  notes?: string | null;
};

export type GetVisasWithClientsParams = PaginationParams & { filters?: Partial<VisaFilters> };

// Append-only forward-only status lifecycle (issue #355, design §Strict
// forward-only status lifecycle). `completed` is terminal — no further
// transitions allowed.
export const VISA_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  pending: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

export function rowToVisa(row: Record<string, unknown>): Visa {
  return {
    id: row.id as string,
    clientId: (row.client_id as string) ?? "",
    country: row.country as string,
    visaType: row.visa_type as string,
    deadline: row.deadline as string,
    price: Number(row.price),
    notes: (row.notes as string) ?? undefined,
    status: row.status as VisaStatus,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

export function rowToVisaStatusHistory(row: Record<string, unknown>): VisaStatusHistoryEntry {
  return {
    id: row.id as string,
    visaId: row.visa_id as string,
    fromStatus: (row.from_status as VisaStatus | null) ?? null,
    toStatus: row.to_status as VisaStatus,
    changedAt: row.changed_at as string,
  };
}

function assertCreateVisaInput(input: CreateVisaInput): void {
  if (!input.country || !input.country.trim()) {
    throw new Error("country is required");
  }
  if (!input.visaType || !input.visaType.trim()) {
    throw new Error("visaType is required");
  }
  if (!input.deadline || !input.deadline.trim()) {
    throw new Error("deadline is required");
  }
  if (input.price === undefined || input.price === null || Number.isNaN(input.price)) {
    throw new Error("price is required");
  }
}

export async function createVisa(input: CreateVisaInput): Promise<Visa> {
  assertCreateVisaInput(input);
  const clientIds = input.clientIds ?? [];

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visas")
    .insert({
      client_id: clientIds[0] ?? null,
      country: input.country.trim(),
      visa_type: input.visaType.trim(),
      deadline: input.deadline,
      price: input.price,
      notes: input.notes?.trim() || null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  const visa = rowToVisa(data);

  if (clientIds.length) {
    const { error: linkError } = await supabase
      .from("visa_clients")
      .insert(clientIds.map((clientId) => ({ visa_id: visa.id, client_id: clientId })));
    if (linkError) throw linkError;
  }

  const { error: historyError } = await supabase.from("visa_status_history").insert({
    visa_id: visa.id,
    from_status: null,
    to_status: "pending",
  });
  if (historyError) throw historyError;

  return visa;
}

function escapeVisaIlike(value: string): string {
  return value.replace(/[%,_*]/g, " ").trim();
}

function visaMatchesFilters(
  visa: Visa,
  clients: Client[],
  filters: Partial<VisaFilters>
): boolean {
  if (filters.status?.length && !filters.status.includes(visa.status)) return false;
  if (filters.clientIds?.length) {
    const ids = new Set(clients.map((c) => c.id));
    if (!filters.clientIds.some((cid) => ids.has(cid))) return false;
  }
  if (filters.country?.trim()) {
    if (visa.country.toLowerCase() !== filters.country.trim().toLowerCase()) return false;
  }
  const q = filters.query?.trim().toLowerCase();
  if (q) {
    const haystack = [visa.country, visa.visaType, visa.notes, ...clients.map((c) => c.name)]
      .filter((v): v is string => Boolean(v))
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export async function getVisaById(id: string): Promise<VisaWithDetails | null> {
  const supabase = await createServerSupabase();
  const { data: visaRow, error } = await supabase
    .from("visas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!visaRow) return null;
  return assembleVisaWithDetails(visaRow);
}

export async function getVisasWithClients(
  params: GetVisasWithClientsParams = {}
): Promise<PaginatedResult<Visa & { clients: Client[] }>> {
  const filters = params.filters ?? {};
  const { from, to } = paginationBounds(params);

  const supabase = await createServerSupabase();
  let query = supabase.from("visas").select("*", { count: "exact" });

  if (filters.status?.length) query = query.in("status", filters.status);
  if (filters.country?.trim()) query = query.eq("country", filters.country.trim());

  const q = escapeVisaIlike(filters.query?.trim() ?? "");
  if (q) query = query.ilike("country", `%${q}%`);

  // When clientIds filter is set we pre-resolve matching visa ids, otherwise
  // we hydrate clients for every visa in the page below.
  let visaIdsByClientFilter: Set<string> | null = null;
  if (filters.clientIds?.length) {
    const { data: linkRows, error: linksError } = await supabase
      .from("visa_clients")
      .select("visa_id")
      .in("client_id", filters.clientIds);
    if (linksError) throw linksError;
    visaIdsByClientFilter = new Set((linkRows ?? []).map((l) => l.visa_id as string));
    if (visaIdsByClientFilter.size === 0) return { items: [], totalCount: 0 };
    query = query.in("id", [...visaIdsByClientFilter]);
  }

  const { data: visaRows, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const visas = (visaRows ?? []).map(rowToVisa);
  const totalCount = count ?? 0;
  const visaIds = visas.map((v) => v.id);
  if (!visaIds.length) return { items: [], totalCount };

  const { data: linkRows, error: pageLinksError } = await supabase
    .from("visa_clients")
    .select("visa_id, client_id, created_at")
    .in("visa_id", visaIds)
    .order("created_at", { ascending: true });
  if (pageLinksError) throw pageLinksError;

  const clientIds = [...new Set((linkRows ?? []).map((l) => l.client_id as string))];
  let clientsById = new Map<string, Client>();
  if (clientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    if (clientsError) throw clientsError;
    clientsById = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
  }

  const clientByVisa = new Map<string, Client[]>();
  for (const link of linkRows ?? []) {
    const visaId = link.visa_id as string;
    const clientId = link.client_id as string;
    const client = clientsById.get(clientId);
    if (!client) continue;
    const list = clientByVisa.get(visaId) ?? [];
    list.push(client);
    clientByVisa.set(visaId, list);
  }

  const filtered = visas
    .map((v) => ({ ...v, clients: clientByVisa.get(v.id) ?? [] }))
    .filter((v) => visaMatchesFilters(v, v.clients, filters));

  return { items: filtered, totalCount };
}

export async function getVisasByClientId(clientId: string): Promise<Visa[]> {
  // El portal del cliente autentica con una cookie propia (PIN), no con
  // Supabase Auth, así que createServerSupabase() corre como `anon` y la RLS no
  // puede acotar filas por usuario. La migración 20260930000000_visas.sql
  // revoca `visa_clients` para anon, por lo que se usa el service role, igual
  // que getClientProfileForHome/getClientHomeTrips. Si falta la service key, se
  // degrada a [] sin romper el home del cliente.
  if (!canUseServiceRole()) return [];
  const supabase = getSupabaseAdmin();
  const { data: links, error: linksError } = await supabase
    .from("visa_clients")
    .select("visa_id")
    .eq("client_id", clientId);
  if (linksError) throw linksError;
  const visaIds = (links ?? []).map((l) => l.visa_id as string);
  if (!visaIds.length) return [];
  const { data, error } = await supabase
    .from("visas")
    .select("*")
    .in("id", visaIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToVisa);
}

export async function updateVisa(id: string, input: UpdateVisaInput): Promise<Visa> {
  // Note: status is intentionally absent from UpdateVisaInput — use
  // transitionVisaStatus to change status. This keeps the type system in
  // sync with the design decision that mutable-field edits and status
  // transitions are disjoint operations.
  const now = new Date().toISOString();

  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { updated_at: now };
  if (input.country !== undefined) patch.country = input.country.trim();
  if (input.visaType !== undefined) patch.visa_type = input.visaType.trim();
  if (input.deadline !== undefined) patch.deadline = input.deadline;
  if (input.price !== undefined) patch.price = input.price;
  if (input.notes !== undefined) patch.notes = input.notes;
  const { data, error } = await supabase
    .from("visas")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToVisa(data);
}

// Replaces the assigned-clients set with a diff (remove dropped + add new,
// preserving created_at for retained rows). Empty list is allowed and zeroes
// the assignment. The visas.client_id mirror is set to clientIds[0] or null.
export async function setVisaClients(visaId: string, clientIds: string[]): Promise<void> {
  const nextIds = Array.from(new Set(clientIds));

  const supabase = await createServerSupabase();
  const { data: currentRows, error: currentError } = await supabase
    .from("visa_clients")
    .select("client_id")
    .eq("visa_id", visaId);
  if (currentError) throw currentError;
  const currentIds = new Set((currentRows ?? []).map((r) => r.client_id as string));
  const toRemove = [...currentIds].filter((id) => !nextIds.includes(id));
  const toAdd = nextIds.filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from("visa_clients")
      .delete()
      .eq("visa_id", visaId)
      .in("client_id", toRemove);
    if (removeError) throw removeError;
  }

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("visa_clients")
      .upsert(
        toAdd.map((clientId) => ({ visa_id: visaId, client_id: clientId })),
        { onConflict: "visa_id,client_id", ignoreDuplicates: true }
      );
    if (addError) throw addError;
  }

  const { error: mirrorError } = await supabase
    .from("visas")
    .update({ client_id: nextIds[0] ?? null })
    .eq("id", visaId);
  if (mirrorError) throw mirrorError;
}

export async function transitionVisaStatus(
  visaId: string,
  toStatus: VisaStatus
): Promise<VisaStatusHistoryEntry> {
  const current = await getCurrentVisaStatus(visaId);
  const allowed = VISA_TRANSITIONS[current] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Illegal visa status transition: ${current} -> ${toStatus}. ` +
        `Allowed from ${current}: [${allowed.join(", ")}]`
    );
  }

  const now = new Date().toISOString();

  const supabase = await createServerSupabase();
  const { error: updateError } = await supabase
    .from("visas")
    .update({ status: toStatus, updated_at: now })
    .eq("id", visaId);
  if (updateError) throw updateError;

  const { data: historyRow, error: historyError } = await supabase
    .from("visa_status_history")
    .insert({
      visa_id: visaId,
      from_status: current,
      to_status: toStatus,
    })
    .select()
    .single();
  if (historyError) throw historyError;
  return rowToVisaStatusHistory(historyRow);
}

export async function getVisaStatusHistory(visaId: string): Promise<VisaStatusHistoryEntry[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visa_status_history")
    .select("*")
    .eq("visa_id", visaId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToVisaStatusHistory);
}

async function getCurrentVisaStatus(visaId: string): Promise<VisaStatus> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visas")
    .select("status")
    .eq("id", visaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Visa not found");
  return data.status as VisaStatus;
}

async function assembleVisaWithDetails(
  visaRow: Record<string, unknown>
): Promise<VisaWithDetails> {
  const supabase = await createServerSupabase();
  const visa = rowToVisa(visaRow);

  const { data: linkRows, error: linksError } = await supabase
    .from("visa_clients")
    .select("client_id, created_at")
    .eq("visa_id", visa.id)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const orderedClientIds = (linkRows ?? []).map((l) => l.client_id as string);
  let clients: Client[] = [];
  if (orderedClientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", orderedClientIds);
    if (clientsError) throw clientsError;
    const byId = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
    clients = orderedClientIds.map((id) => byId.get(id)).filter((c): c is Client => Boolean(c));
  }
  const client = clients[0] ?? ({} as Client);

  const statusHistory = await getVisaStatusHistory(visa.id);

  // Documents are intentionally not loaded in Phase 2 — Phase 3 will hydrate
  // them via getVisaDocuments and merge the signed URLs here.
  return {
    ...visa,
    clients,
    client,
    statusHistory,
    documents: [],
  };
}
