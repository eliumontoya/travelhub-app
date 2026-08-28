import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export type TravelHubClientToolName =
  | "getClientByWhatsappPhone"
  | "getClientActiveTrips"
  | "getTripSummary"
  | "getTripItineraryStatus"
  | "getTripPaymentStatus"
  | "getTripDocumentsStatus";

export type TravelHubClientToolStatus = "success" | "not_found" | "ambiguous" | "blocked" | "needs_human" | "error";

export type TravelHubToolAudit = {
  attempted: boolean;
  ok: boolean;
  eventId?: string;
  error?: string;
};

export type TravelHubClientToolResult<TData = unknown> = {
  tool: TravelHubClientToolName | string;
  status: TravelHubClientToolStatus;
  data?: TData;
  reason?: string;
  audit?: TravelHubToolAudit;
};

export type TravelHubToolSupabaseClient = Pick<SupabaseClient, "from">;

export type TravelHubClientMatch = {
  found: boolean;
  clientId?: string;
  displayName?: string;
  matchConfidence: "exact" | "possible" | "none";
};

export type TravelHubTripChoice = {
  tripId: string;
  title: string;
  slug: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

const phoneSchema = z.object({ phone: z.string().trim().min(5).max(32) });
const clientSchema = z.object({ clientId: z.string().trim().min(1).max(100) });
const tripSchema = clientSchema.extend({ tripId: z.string().trim().min(1).max(100) });
const allowedTools: TravelHubClientToolName[] = [
  "getClientByWhatsappPhone",
  "getClientActiveTrips",
  "getTripSummary",
  "getTripItineraryStatus",
  "getTripPaymentStatus",
  "getTripDocumentsStatus",
];
const unpublishedTripPlanningMessage = "Tu viaje todavía está siendo planeado por un agente. En cuanto esté publicado, podrás tener más información.";

function createDefaultToolClient(): TravelHubToolSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizeError(error: unknown) {
  if (!error) return undefined;
  const message = error instanceof Error ? error.message : typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  return message.replace(/service[_ -]?role|bearer|token|key|secret/gi, "credential").slice(0, 160);
}

function safeResult<TData = unknown>(tool: TravelHubClientToolName | string, status: TravelHubClientToolStatus, data?: TData, reason?: string): TravelHubClientToolResult<TData> {
  return {
    tool,
    status,
    ...(data === undefined ? {} : { data }),
    ...(reason ? { reason } : {}),
  };
}

function unpublishedTripPlanningData() {
  return {
    publicItineraryAvailable: false,
    safeMessage: unpublishedTripPlanningMessage,
  };
}

async function auditToolCall(
  client: TravelHubToolSupabaseClient | null,
  tool: TravelHubClientToolName | string,
  status: TravelHubClientToolStatus,
  identifiers: Record<string, string | undefined>
): Promise<TravelHubToolAudit> {
  if (!client) return { attempted: false, ok: false, error: "Supabase audit client is not configured." };

  try {
    const subject = identifiers.tripId ?? identifiers.clientId ?? identifiers.phone ?? "unknown";
    const eventKey = `whatsapp:tool_called:${tool}:${subject}:${Date.now()}`;
    const result = await client
      .from("crm_sync_events")
      .upsert(
        {
          source_table: "whatsapp_tool_calls",
          source_id: identifiers.sourceId ?? "00000000-0000-0000-0000-000000000000",
          event_type: "whatsapp.tool_called",
          aggregate_type: "whatsapp_conversation",
          aggregate_id: identifiers.conversationId ?? null,
          event_key: eventKey,
          status: "pending",
          payload: {
            tool,
            status,
            clientId: identifiers.clientId,
            tripId: identifiers.tripId,
            phoneSuffix: identifiers.phone ? identifiers.phone.slice(-4) : undefined,
          },
        },
        { onConflict: "event_key", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    if (result.error) return { attempted: true, ok: false, error: sanitizeError(result.error) };
    return { attempted: true, ok: true, eventId: result.data?.id };
  } catch (error) {
    return { attempted: true, ok: false, error: sanitizeError(error) };
  }
}

async function withAudit<TData>(
  client: TravelHubToolSupabaseClient | null,
  result: TravelHubClientToolResult<TData>,
  identifiers: Record<string, string | undefined>
) {
  return { ...result, audit: await auditToolCall(client, result.tool, result.status, identifiers) };
}


async function lookupClientRowsByWhatsapp(client: TravelHubToolSupabaseClient, phone: string) {
  const result = await client
    .from("clients")
    .select("id, name, whatsapp")
    .eq("whatsapp_normalized", phone)
    .limit(2);
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data as Record<string, unknown>[] : [];
}

function clientLookupResultFromMatches(matches: Record<string, unknown>[], ambiguousReason: string): TravelHubClientToolResult<TravelHubClientMatch | undefined> | null {
  if (matches.length === 1 && typeof matches[0].id === "string") {
    return safeResult("getClientByWhatsappPhone", "success", {
      found: true,
      clientId: matches[0].id,
      displayName: typeof matches[0].name === "string" ? matches[0].name : undefined,
      matchConfidence: "exact" as const,
    });
  }
  if (matches.length > 1) {
    return safeResult("getClientByWhatsappPhone", "ambiguous", { found: false, matchConfidence: "possible" as const }, ambiguousReason);
  }
  return null;
}

function getClientName(row: Record<string, unknown>) {
  const nested = row.clients;
  if (nested && typeof nested === "object" && !Array.isArray(nested) && typeof (nested as { name?: unknown }).name === "string") {
    return (nested as { name: string }).name;
  }
  return typeof row.name === "string" ? row.name : typeof row.display_name === "string" ? row.display_name : undefined;
}

export async function getClientByWhatsappPhone(
  input: { phone: string },
  client: TravelHubToolSupabaseClient | null = createDefaultToolClient()
): Promise<TravelHubClientToolResult<TravelHubClientMatch | undefined>> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) return safeResult("getClientByWhatsappPhone", "blocked", undefined, "Invalid phone input.");
  if (!client) return safeResult("getClientByWhatsappPhone", "error", undefined, "TravelHub tool client is not configured.");

  const phone = normalizePhone(parsed.data.phone);
  try {
    const whatsappMatches = await lookupClientRowsByWhatsapp(client, phone);
    const whatsappResult = clientLookupResultFromMatches(whatsappMatches, "Multiple TravelHub clients match this WhatsApp phone.");
    if (whatsappResult) {
      const clientId = whatsappResult.data?.found === true ? whatsappResult.data.clientId : undefined;
      return withAudit(client, whatsappResult, { phone, clientId });
    }

    const contact = await client
      .from("whatsapp_contacts")
      .select("linked_client_id, display_name, phone_e164, clients(id, name)")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (contact.error) throw contact.error;
    const contactRow = contact.data as Record<string, unknown> | null;
    if (contactRow && typeof contactRow.linked_client_id === "string") {
      return withAudit(
        client,
        safeResult("getClientByWhatsappPhone", "success", {
          found: true,
          clientId: contactRow.linked_client_id,
          displayName: getClientName(contactRow),
          matchConfidence: "exact",
        }),
        { phone, clientId: contactRow.linked_client_id }
      );
    }

    const fallback = await client
      .from("clients")
      .select("id, name, phone")
      .in("phone", Array.from(new Set([parsed.data.phone, phone])))
      .limit(2);
    if (fallback.error) throw fallback.error;
    const matches = Array.isArray(fallback.data) ? fallback.data as Record<string, unknown>[] : [];
    const fallbackResult = clientLookupResultFromMatches(matches, "Multiple possible clients match this phone.");
    if (fallbackResult) {
      const clientId = fallbackResult.data?.found === true ? fallbackResult.data.clientId : undefined;
      return withAudit(client, fallbackResult, { phone, clientId });
    }

    return withAudit(
      client,
      safeResult("getClientByWhatsappPhone", "not_found", { found: false, matchConfidence: "none" }, "No TravelHub client is linked to this WhatsApp phone."),
      { phone }
    );
  } catch (error) {
    return withAudit(client, safeResult("getClientByWhatsappPhone", "error", undefined, sanitizeError(error) ?? "Client lookup failed."), { phone });
  }
}


function normalizeTrip(row: Record<string, unknown>): TravelHubTripChoice | null {
  const source = row.trips && typeof row.trips === "object" && !Array.isArray(row.trips) ? row.trips as Record<string, unknown> : row;
  if (typeof source.id !== "string" || typeof source.title !== "string") return null;
  const status = typeof source.status === "string" ? source.status : "draft";
  if (status !== "published") {
    return {
      tripId: source.id,
      title: "Viaje en planeación",
      slug: null,
      startDate: null,
      endDate: null,
      status,
    };
  }
  return {
    tripId: source.id,
    title: source.title,
    slug: typeof source.slug === "string" ? source.slug : null,
    startDate: typeof source.start_date === "string" ? source.start_date : null,
    endDate: typeof source.end_date === "string" ? source.end_date : null,
    status,
  };
}

export async function getClientActiveTrips(
  input: { clientId: string },
  client: TravelHubToolSupabaseClient | null = createDefaultToolClient()
): Promise<TravelHubClientToolResult<{ trips: TravelHubTripChoice[] } | undefined>> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return safeResult("getClientActiveTrips", "blocked", undefined, "Invalid client input.");
  if (!client) return safeResult("getClientActiveTrips", "error", undefined, "TravelHub tool client is not configured.");

  try {
    const throughBridge = await client
      .from("trip_clients")
      .select("trip_id, trips(id, title, slug, start_date, end_date, status)")
      .eq("client_id", parsed.data.clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (throughBridge.error) throw throughBridge.error;

    const legacy = await client
      .from("trips")
      .select("id, title, slug, start_date, end_date, status")
      .eq("client_id", parsed.data.clientId)
      .neq("status", "archived")
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(5);
    if (legacy.error) throw legacy.error;

    const tripsById = new Map<string, TravelHubTripChoice>();
    for (const row of [...(Array.isArray(throughBridge.data) ? throughBridge.data : []), ...(Array.isArray(legacy.data) ? legacy.data : [])]) {
      const trip = normalizeTrip(row as Record<string, unknown>);
      if (trip && trip.status !== "archived") tripsById.set(trip.tripId, trip);
    }
    const trips = [...tripsById.values()];
    const status: TravelHubClientToolStatus = trips.length === 0 ? "not_found" : trips.length > 1 ? "ambiguous" : "success";
    const reason = trips.length === 0 ? "No active or recent trips were found for this client." : trips.length > 1 ? "Multiple active or recent trips require clarification." : undefined;
    return withAudit(client, safeResult("getClientActiveTrips", status, { trips }, reason), { clientId: parsed.data.clientId });
  } catch (error) {
    return withAudit(client, safeResult("getClientActiveTrips", "error", undefined, sanitizeError(error) ?? "Trip lookup failed."), { clientId: parsed.data.clientId });
  }
}

async function verifyTripOwnership(client: TravelHubToolSupabaseClient, clientId: string, tripId: string) {
  const bridge = await client
    .from("trip_clients")
    .select("trip_id")
    .eq("client_id", clientId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (bridge.error) throw bridge.error;
  if (bridge.data) return true;

  const legacy = await client
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  return Boolean(legacy.data);
}

async function guardTripTool(tool: TravelHubClientToolName, input: { clientId: string; tripId: string }, client: TravelHubToolSupabaseClient | null) {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) return { parsed: null, result: safeResult(tool, "blocked", undefined, "Invalid client or trip input.") };
  if (!client) return { parsed: parsed.data, result: safeResult(tool, "error", undefined, "TravelHub tool client is not configured.") };

  try {
    const owned = await verifyTripOwnership(client, parsed.data.clientId, parsed.data.tripId);
    if (!owned) {
      return {
        parsed: parsed.data,
        result: await withAudit(
          client,
          safeResult(tool, "blocked", undefined, "Requested trip does not belong to the resolved WhatsApp client."),
          parsed.data
        ),
      };
    }
    const tripStatus = await client
      .from("trips")
      .select("id, status")
      .eq("id", parsed.data.tripId)
      .maybeSingle();
    if (tripStatus.error) throw tripStatus.error;
    const tripRow = tripStatus.data as Record<string, unknown> | null;
    if (!tripRow || typeof tripRow.id !== "string") {
      return {
        parsed: parsed.data,
        result: await withAudit(client, safeResult(tool, "not_found", undefined, "Trip not found."), parsed.data),
      };
    }
    if (tripRow.status !== "published") {
      return {
        parsed: parsed.data,
        result: await withAudit(
          client,
          safeResult(tool, "success", unpublishedTripPlanningData(), "Trip is not published yet."),
          parsed.data
        ),
      };
    }
    return { parsed: parsed.data, result: null };
  } catch (error) {
    return { parsed: parsed.data, result: await withAudit(client, safeResult(tool, "error", undefined, sanitizeError(error) ?? "Ownership validation failed."), parsed.data) };
  }
}

export async function getTripSummary(input: { clientId: string; tripId: string }, client: TravelHubToolSupabaseClient | null = createDefaultToolClient()): Promise<TravelHubClientToolResult> {
  const guarded = await guardTripTool("getTripSummary", input, client);
  if (guarded.result || !guarded.parsed || !client) return guarded.result ?? safeResult("getTripSummary", "error", undefined, "TravelHub tool client is not configured.");

  try {
    const trip = await client
      .from("trips")
      .select("id, title, slug, start_date, end_date, status, traveler_count, currency, show_costs_to_client")
      .eq("id", guarded.parsed.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    const row = trip.data as Record<string, unknown> | null;
    if (!row || typeof row.id !== "string") return withAudit(client, safeResult("getTripSummary", "not_found", undefined, "Trip not found."), guarded.parsed);

    return withAudit(
      client,
      safeResult("getTripSummary", "success", {
        tripId: row.id,
        title: typeof row.title === "string" ? row.title : "Viaje",
        slug: typeof row.slug === "string" ? row.slug : null,
        startDate: typeof row.start_date === "string" ? row.start_date : null,
        endDate: typeof row.end_date === "string" ? row.end_date : null,
        status: typeof row.status === "string" ? row.status : "draft",
        travelerCount: typeof row.traveler_count === "number" ? row.traveler_count : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        publicItineraryAvailable: row.status === "published" && typeof row.slug === "string",
      }),
      guarded.parsed
    );
  } catch (error) {
    return withAudit(client, safeResult("getTripSummary", "error", undefined, sanitizeError(error) ?? "Trip summary failed."), guarded.parsed);
  }
}

export async function getTripItineraryStatus(input: { clientId: string; tripId: string }, client: TravelHubToolSupabaseClient | null = createDefaultToolClient()): Promise<TravelHubClientToolResult> {
  const guarded = await guardTripTool("getTripItineraryStatus", input, client);
  if (guarded.result || !guarded.parsed || !client) return guarded.result ?? safeResult("getTripItineraryStatus", "error", undefined, "TravelHub tool client is not configured.");

  try {
    const daysResult = await client
      .from("trip_days")
      .select("id, date, items(id, type, title, start_time, end_time, location, confirmation_code)")
      .eq("trip_id", guarded.parsed.tripId)
      .order("sort_order", { ascending: true });
    if (daysResult.error) throw daysResult.error;
    const days = Array.isArray(daysResult.data) ? daysResult.data as Record<string, unknown>[] : [];
    const itemCounts: Record<string, number> = {};
    const nextItems: Array<Record<string, string | null>> = [];
    for (const day of days) {
      const items = Array.isArray(day.items) ? day.items as Record<string, unknown>[] : [];
      for (const item of items) {
        const type = typeof item.type === "string" ? item.type : "unknown";
        itemCounts[type] = (itemCounts[type] ?? 0) + 1;
        if (nextItems.length < 5) {
          nextItems.push({
            title: typeof item.title === "string" ? item.title : "Actividad",
            type,
            date: typeof day.date === "string" ? day.date : null,
            startTime: typeof item.start_time === "string" ? item.start_time : null,
            location: typeof item.location === "string" ? item.location : null,
            confirmationAvailable: item.confirmation_code ? "yes" : "no",
          });
        }
      }
    }
    return withAudit(client, safeResult("getTripItineraryStatus", "success", { dayCount: days.length, itemCounts, nextItems }), guarded.parsed);
  } catch (error) {
    return withAudit(client, safeResult("getTripItineraryStatus", "error", undefined, sanitizeError(error) ?? "Itinerary status failed."), guarded.parsed);
  }
}

export async function getTripPaymentStatus(input: { clientId: string; tripId: string }, client: TravelHubToolSupabaseClient | null = createDefaultToolClient()): Promise<TravelHubClientToolResult> {
  const guarded = await guardTripTool("getTripPaymentStatus", input, client);
  if (guarded.result || !guarded.parsed || !client) return guarded.result ?? safeResult("getTripPaymentStatus", "error", undefined, "TravelHub tool client is not configured.");

  return withAudit(
    client,
    safeResult("getTripPaymentStatus", "needs_human", {
      policy: "payment_status_requires_human",
      safeMessage: "Payment status is not available for automatic WhatsApp answers yet.",
    }, "TravelHub does not have an explicit payment system-of-record and auto-answer policy yet."),
    guarded.parsed
  );
}

export async function getTripDocumentsStatus(input: { clientId: string; tripId: string }, client: TravelHubToolSupabaseClient | null = createDefaultToolClient()): Promise<TravelHubClientToolResult> {
  const guarded = await guardTripTool("getTripDocumentsStatus", input, client);
  if (guarded.result || !guarded.parsed || !client) return guarded.result ?? safeResult("getTripDocumentsStatus", "error", undefined, "TravelHub tool client is not configured.");

  try {
    const tripDocs = await client
      .from("trip_documents")
      .select("id")
      .eq("trip_id", guarded.parsed.tripId);
    if (tripDocs.error) throw tripDocs.error;

    const dayDocs = await client
      .from("trip_days")
      .select("items(id, documents(id))")
      .eq("trip_id", guarded.parsed.tripId);
    if (dayDocs.error) throw dayDocs.error;

    const tripDocumentCount = Array.isArray(tripDocs.data) ? tripDocs.data.length : 0;
    let itemDocumentCount = 0;
    for (const day of Array.isArray(dayDocs.data) ? dayDocs.data as Record<string, unknown>[] : []) {
      for (const item of Array.isArray(day.items) ? day.items as Record<string, unknown>[] : []) {
        itemDocumentCount += Array.isArray(item.documents) ? item.documents.length : 0;
      }
    }

    return withAudit(
      client,
      safeResult("getTripDocumentsStatus", "success", {
        tripDocumentCount,
        itemDocumentCount,
        hasDocuments: tripDocumentCount + itemDocumentCount > 0,
        linksIncluded: false,
      }),
      guarded.parsed
    );
  } catch (error) {
    return withAudit(client, safeResult("getTripDocumentsStatus", "error", undefined, sanitizeError(error) ?? "Document status failed."), guarded.parsed);
  }
}

export async function runTravelHubClientTool(
  request: { tool: string; arguments: unknown },
  client: TravelHubToolSupabaseClient | null = createDefaultToolClient()
): Promise<TravelHubClientToolResult> {
  if (!allowedTools.includes(request.tool as TravelHubClientToolName)) {
    return safeResult(request.tool, "blocked", undefined, "Unsupported TravelHub client tool.");
  }

  switch (request.tool) {
    case "getClientByWhatsappPhone":
      return getClientByWhatsappPhone(request.arguments as { phone: string }, client);
    case "getClientActiveTrips":
      return getClientActiveTrips(request.arguments as { clientId: string }, client);
    case "getTripSummary":
      return getTripSummary(request.arguments as { clientId: string; tripId: string }, client);
    case "getTripItineraryStatus":
      return getTripItineraryStatus(request.arguments as { clientId: string; tripId: string }, client);
    case "getTripPaymentStatus":
      return getTripPaymentStatus(request.arguments as { clientId: string; tripId: string }, client);
    case "getTripDocumentsStatus":
      return getTripDocumentsStatus(request.arguments as { clientId: string; tripId: string }, client);
    default:
      return safeResult(request.tool, "blocked", undefined, "Unsupported TravelHub client tool.");
  }
}
