import { describe, expect, it } from "vitest";
import { canRenderTravelerActivityControls } from "@/lib/traveler-activity-controls";

describe("traveler activity controls eligibility", () => {
  it("allows controls only for a signed-in assigned traveler on a published trip", () => {
    expect(
      canRenderTravelerActivityControls({
        tripStatus: "published",
        clientId: "client-1",
        hasAssignment: true,
      })
    ).toBe(true);
  });

  it("keeps anonymous, unassigned, and non-published viewers read-only", () => {
    expect(
      canRenderTravelerActivityControls({ tripStatus: "published", clientId: null, hasAssignment: true })
    ).toBe(false);
    expect(
      canRenderTravelerActivityControls({ tripStatus: "published", clientId: "client-1", hasAssignment: false })
    ).toBe(false);
    expect(
      canRenderTravelerActivityControls({ tripStatus: "draft", clientId: "client-1", hasAssignment: true })
    ).toBe(false);
  });
});
