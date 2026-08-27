import { AsyncLocalStorage } from "node:async_hooks";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * AsyncLocalStorage used to propagate the injected service-role Supabase client
 * through the MCP tool call stack. Tool handlers run inside
 * `runWithMcpSupabase`, so any data-layer function that is not explicitly
 * passed a client can retrieve the same privileged client from the store.
 */
const mcpSupabaseStore = new AsyncLocalStorage<SupabaseClient>();

export function getMcpSupabaseClient(): SupabaseClient | undefined {
  return mcpSupabaseStore.getStore();
}

export function runWithMcpSupabase<T>(
  client: SupabaseClient,
  fn: () => Promise<T>
): Promise<T> {
  return mcpSupabaseStore.run(client, fn);
}
