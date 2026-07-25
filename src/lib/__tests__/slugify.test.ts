import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("convierte texto a minúsculas y sin espacios", () => {
    expect(slugify("Hola Mundo")).toBe("hola-mundo");
  });

  it("elimina tildes y caracteres especiales", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("México")).toBe("mexico");
  });

  it("reemplaza espacios y caracteres no alfanuméricos por guiones", () => {
    expect(slugify("viaje a la playa!")).toBe("viaje-a-la-playa");
  });

  it("elimina guiones al inicio y final", () => {
    expect(slugify("  hola  ")).toBe("hola");
    expect(slugify("--test--")).toBe("test");
  });

  it("maneja strings vacíos", () => {
    expect(slugify("")).toBe("");
  });

  it("conserva números", () => {
    expect(slugify("viaje 2026")).toBe("viaje-2026");
  });

  it("colapsa guiones múltiples", () => {
    expect(slugify("hola   mundo")).toBe("hola-mundo");
  });
});
