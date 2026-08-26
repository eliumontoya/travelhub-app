import { describe, expect, it } from "vitest";
import { hasSettingsSavedFlash } from "../dashboard-flash";

describe("hasSettingsSavedFlash", () => {
  it("shows the settings success flash only for the explicit success marker", () => {
    expect(hasSettingsSavedFlash({ settingsSaved: "1" })).toBe(true);
    expect(hasSettingsSavedFlash({ settingsSaved: ["1", "0"] })).toBe(true);
    expect(hasSettingsSavedFlash({ settingsSaved: "0" })).toBe(false);
    expect(hasSettingsSavedFlash({})).toBe(false);
  });
});
