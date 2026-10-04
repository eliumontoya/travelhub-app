import { PackingItem } from "@/types";
import { createServerSupabase } from "@/lib/data/shared";

// ---------- Packing list (issue #24) ----------

export type CreatePackingItemInput = { tripId: string; label: string; sortOrder?: number };
export type UpdatePackingItemInput = Partial<{ label: string; checked: boolean; sortOrder: number }>;

export async function createPackingItem(input: CreatePackingItemInput): Promise<PackingItem> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("packing_items")
    .insert({
      trip_id: input.tripId,
      label: input.label,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPackingItem(data);
}

export async function updatePackingItem(
  id: string,
  input: UpdatePackingItemInput
): Promise<PackingItem> {
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.checked !== undefined) patch.checked = input.checked;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase
    .from("packing_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToPackingItem(data);
}

export async function deletePackingItem(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("packing_items").delete().eq("id", id);
  if (error) throw error;
}

export function rowToPackingItem(row: Record<string, unknown>): PackingItem {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    label: row.label as string,
    checked: row.checked as boolean,
    sortOrder: row.sort_order as number,
  };
}
