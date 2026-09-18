import { describe, expect, it } from "vitest";
import { validateClientPin } from "@/lib/client-pin-validation";

describe("validateClientPin", () => {
  it("accepts a 4-digit matching PIN pair", () => {
    expect(validateClientPin("1234", "1234")).toEqual({ ok: true });
  });

  it("accepts a 6-digit matching PIN pair", () => {
    expect(validateClientPin("123456", "123456")).toEqual({ ok: true });
  });

  it("rejects a PIN shorter than 4 digits", () => {
    expect(validateClientPin("123", "123")).toEqual({
      ok: false,
      error: "El PIN debe tener entre 4 y 6 dígitos.",
    });
  });

  it("rejects a PIN longer than 6 digits", () => {
    expect(validateClientPin("1234567", "1234567")).toEqual({
      ok: false,
      error: "El PIN debe tener entre 4 y 6 dígitos.",
    });
  });

  it("rejects a PIN with non-numeric characters", () => {
    expect(validateClientPin("12a4", "12a4")).toEqual({
      ok: false,
      error: "El PIN solo puede contener números.",
    });
  });

  it("rejects mismatched PIN confirmation", () => {
    expect(validateClientPin("1234", "1235")).toEqual({
      ok: false,
      error: "Los PINs no coinciden.",
    });
  });

  it("rejects empty PIN values", () => {
    expect(validateClientPin("", "")).toEqual({
      ok: false,
      error: "El PIN debe tener entre 4 y 6 dígitos.",
    });
  });
});
