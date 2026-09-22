import { describe, expect, it } from "bun:test";
import { maskSensitiveWebhookPayload } from "./webhookPayloadMasking";

/**
 * SPEC 10, A-E6 (DA6, W7) — T-10.17: a API de logs devolve e-mail, telefone
 * e CNPJ mascarados; o banco guarda completo (a máscara só roda na
 * leitura). Controle negativo obrigatório: remover a máscara e ver vermelho
 * (executado manualmente durante a implementação, conferido por `git diff`).
 */
describe("maskSensitiveWebhookPayload (T-10.17)", () => {
  it("mascara email, phone e cnpj no primeiro nível", () => {
    const raw = {
      name: "João da Silva",
      email: "joao.silva@example.com",
      phone: "11999998888",
      cnpj: "12.345.678/0001-95",
    };

    const masked = maskSensitiveWebhookPayload(raw) as Record<string, string>;

    expect(masked.name).toBe("João da Silva");
    expect(masked.email).not.toBe(raw.email);
    expect(masked.email).toMatch(/\*/);
    expect(masked.email.endsWith("@example.com")).toBe(false);
    expect(masked.phone).not.toBe(raw.phone);
    expect(masked.phone).toMatch(/\*/);
    expect(masked.phone.endsWith("88")).toBe(true);
    expect(masked.cnpj).not.toBe(raw.cnpj);
    expect(masked.cnpj).toMatch(/\*/);
    expect(masked.cnpj.endsWith("95")).toBe(true);
  });

  it("mascara chaves aninhadas (metadata.email, activity payload, etc.)", () => {
    const raw = {
      metadata: { contactEmail: "outro@empresa.com.br", note: "sem dado sensível" },
    };

    const masked = maskSensitiveWebhookPayload(raw) as {
      metadata: { contactEmail: string; note: string };
    };

    expect(masked.metadata.contactEmail).not.toBe(raw.metadata.contactEmail);
    expect(masked.metadata.note).toBe("sem dado sensível");
  });

  it("mascara telefone/cnpj mesmo com chave em português (telefone, whatsapp, documento)", () => {
    const raw = { telefone: "21988887777", whatsapp: "21988887777", documento: "98.765.432/0001-10" };
    const masked = maskSensitiveWebhookPayload(raw) as Record<string, string>;

    expect(masked.telefone).not.toBe(raw.telefone);
    expect(masked.whatsapp).not.toBe(raw.whatsapp);
    expect(masked.documento).not.toBe(raw.documento);
  });

  it("não mexe em valores não sensíveis e preserva estrutura (arrays, números, null)", () => {
    const raw = { tags: ["a", "b"], count: 3, notes: null, active: true };
    expect(maskSensitiveWebhookPayload(raw)).toEqual(raw);
  });

  it("é puro — não muta o objeto original (o banco guarda o dado completo)", () => {
    const raw = { email: "preserva@exemplo.com" };
    const snapshot = JSON.stringify(raw);
    maskSensitiveWebhookPayload(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it("lida com null/undefined/valores primitivos sem quebrar", () => {
    expect(maskSensitiveWebhookPayload(null)).toBeNull();
    expect(maskSensitiveWebhookPayload(undefined)).toBeUndefined();
    expect(maskSensitiveWebhookPayload("string solta")).toBe("string solta");
    expect(maskSensitiveWebhookPayload(42)).toBe(42);
  });

  it("mascara email dentro de texto livre mesmo em chave não sensível (defesa em profundidade)", () => {
    const raw = { errorMessage: "Já existe um lead com o email joao@example.com cadastrado" };
    const masked = maskSensitiveWebhookPayload(raw) as { errorMessage: string };
    expect(masked.errorMessage).not.toContain("joao@example.com");
  });
});
