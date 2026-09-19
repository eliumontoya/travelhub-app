import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import * as dashboardActions from "./actions";
import * as clientActions from "@/app/client/trips/[id]/documents/actions";

describe("dashboard trip actions expose agent-only service mutations", () => {
  it("exports status-transition actions on the dashboard surface", () => {
    expect(typeof dashboardActions.markUploadProcessedAction).toBe("function");
    expect(typeof dashboardActions.requestReUploadAction).toBe("function");
    expect(typeof dashboardActions.addChecklistItemAction).toBe("function");
    expect(typeof dashboardActions.updateChecklistItemAction).toBe("function");
    expect(typeof dashboardActions.deleteChecklistItemAction).toBe("function");
    expect(typeof dashboardActions.reorderChecklistItemsAction).toBe("function");
  });

  it("client actions do not export status-transition functions", () => {
    expect("markUploadProcessedAction" in clientActions).toBe(false);
    expect("requestReUploadAction" in clientActions).toBe(false);
    expect("addChecklistItemAction" in clientActions).toBe(false);
    expect("updateChecklistItemAction" in clientActions).toBe(false);
    expect("deleteChecklistItemAction" in clientActions).toBe(false);
    expect("reorderChecklistItemsAction" in clientActions).toBe(false);
  });
});
