import { TravelAgent } from "@/types";
import { mockTravelAgents, mockTrips } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured, sanitizeNote, uid } from "@/lib/data/shared";

export type CreateTravelAgentInput = {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export function rowToTravelAgent(row: Record<string, unknown>): TravelAgent {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? undefined,
    phone: (row.phone as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

export async function getTravelAgents(): Promise<TravelAgent[]> {
  if (!isSupabaseConfigured()) {
    return [...mockTravelAgents];
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("travel_agents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTravelAgent);
}

export async function getTravelAgentById(id: string): Promise<TravelAgent | null> {
  if (!isSupabaseConfigured()) {
    return mockTravelAgents.find((a) => a.id === id) ?? null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("travel_agents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTravelAgent(data) : null;
}

function validateTravelAgentInput(input: CreateTravelAgentInput): void {
  if (!input.name?.trim()) {
    throw new Error("El nombre es obligatorio");
  }
}

export async function createTravelAgent(input: CreateTravelAgentInput): Promise<TravelAgent> {
  validateTravelAgentInput(input);
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const agent: TravelAgent = {
      id: uid(),
      name: input.name.trim(),
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      notes: sanitizeNote(input.notes),
      createdAt: now,
      updatedAt: now,
    };
    mockTravelAgents.unshift(agent);
    return agent;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("travel_agents")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: sanitizeNote(input.notes) || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTravelAgent(data);
}

export async function updateTravelAgent(
  id: string,
  input: Partial<CreateTravelAgentInput>
): Promise<TravelAgent> {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("El nombre es obligatorio");
  }
  if (!isSupabaseConfigured()) {
    const agent = mockTravelAgents.find((a) => a.id === id);
    if (!agent) throw new Error("Agente no encontrado");
    if (input.name !== undefined) agent.name = input.name.trim();
    if (input.email !== undefined) agent.email = input.email?.trim() || undefined;
    if (input.phone !== undefined) agent.phone = input.phone?.trim() || undefined;
    if (input.notes !== undefined) agent.notes = sanitizeNote(input.notes);
    agent.updatedAt = new Date().toISOString();
    return agent;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.notes !== undefined) patch.notes = sanitizeNote(input.notes) || null;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("travel_agents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTravelAgent(data);
}

export async function deleteTravelAgent(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockTravelAgents.findIndex((a) => a.id === id);
    if (idx >= 0) {
      mockTravelAgents.splice(idx, 1);
      for (const trip of mockTrips) {
        if (trip.assignedAgentId === id) {
          delete trip.assignedAgentId;
        }
      }
    }
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("travel_agents").delete().eq("id", id);
  if (error) throw error;
}
