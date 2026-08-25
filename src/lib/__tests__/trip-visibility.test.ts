import { describe, expect, it } from "vitest";
import { isTravelerTripVisible, travelerPreviewHref } from "@/lib/trip-visibility";

describe("traveler trip visibility", () => {
  it("allows published trips on the final URL", () => {
    expect(isTravelerTripVisible("published", "trip-1", undefined)).toBe(true);
  });

  it("blocks draft trips on the final URL", () => {
    expect(isTravelerTripVisible("draft", "trip-1", undefined)).toBe(false);
  });

  it("allows draft trips only with their preview token", () => {
    expect(isTravelerTripVisible("draft", "trip-1", "trip-1")).toBe(true);
    expect(isTravelerTripVisible("draft", "trip-1", "other")).toBe(false);
  });

  it("uses a preview query only for draft trip links", () => {
    expect(travelerPreviewHref("safari", "trip 1", "draft")).toBe("/t/safari?preview=trip%201");
    expect(travelerPreviewHref("safari", "trip-1", "published")).toBe("/t/safari");
  });
});
