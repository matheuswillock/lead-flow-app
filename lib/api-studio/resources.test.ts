import { describe, expect, it } from "bun:test";
import {
  API_STUDIO_RESOURCES,
  buildApiResourceTokenPreview,
  generateApiResourceToken,
  getApiStudioResource,
  hashApiResourceToken,
} from "./resources";

describe("API Studio — catálogo (SPEC 14, DA1)", () => {
  it("a primeira entrega é um recurso só: horários disponíveis, GA, 30 consultas por minuto", () => {
    expect(Object.keys(API_STUDIO_RESOURCES)).toEqual(["availability"]);
    const resource = API_STUDIO_RESOURCES.availability;
    expect(resource).toMatchObject({ slug: "availability", status: "ga", tokenPrefix: "cs_avail_" });
    expect(resource.rateLimit).toEqual({ limit: 30, windowMs: 60_000 });
  });

  it("slug desconhecido não é recurso", () => {
    expect(getApiStudioResource("availability")?.slug).toBe("availability");
    expect(getApiStudioResource("webhooks")).toBeNull();
    expect(getApiStudioResource("")).toBeNull();
  });
});

describe("API Studio — token por recurso (DA2)", () => {
  it("tem o prefixo do recurso (para scanners de vazamento) e entropia de 256 bits", () => {
    const token = generateApiResourceToken("availability");
    expect(token.startsWith("cs_avail_")).toBe(true);
    expect(token.slice("cs_avail_".length)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dois tokens nunca coincidem", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateApiResourceToken("availability")));
    expect(tokens.size).toBe(50);
  });

  it("só o hash é guardado: determinístico, SHA-256 hex, e não contém o token", () => {
    const token = generateApiResourceToken("availability");
    const hash = hashApiResourceToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashApiResourceToken(token));
    expect(hash).not.toContain(token.slice(-16));
  });

  it("o preview mostra o prefixo e só os 4 últimos caracteres", () => {
    const token = generateApiResourceToken("availability");
    const preview = buildApiResourceTokenPreview(token);
    expect(preview.startsWith("cs_avail_")).toBe(true);
    expect(preview.endsWith(token.slice(-4))).toBe(true);
    expect(preview.length).toBeLessThan(token.length);
    expect(preview).not.toContain(token.slice(10, 30));
  });
});
