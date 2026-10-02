import { describe, expect, it } from "bun:test";
import { PublicLeadFormRequestSchema } from "./requestPublicLeadForm";

/**
 * Achado incidental da SPEC 40 ao escrever o E2E (T-40.9): o front sempre
 * manda `email: ""` quando o campo fica em branco
 * (`PublicLeadForm.tsx` — `email: data.email ?? ""`), mas
 * `z.string().email().nullish()` sozinho não isenta string vazia da
 * checagem de formato — todo envio sem e-mail vinha com 400 "Email
 * inválido", quebrando o caminho mais comum do formulário público (e-mail é
 * opcional, só telefone é obrigatório).
 */
const BASE_PAYLOAD = {
  teamId: "11111111-1111-4111-8111-111111111111",
  name: "Fulano de Tal",
  phone: "11999998888",
  assignedTo: "22222222-2222-4222-8222-222222222222",
};

describe("PublicLeadFormRequestSchema.email", () => {
  it("string vazia (o que o front sempre manda quando o campo fica em branco) é aceita", () => {
    const result = PublicLeadFormRequestSchema.safeParse({ ...BASE_PAYLOAD, email: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("ausente (undefined) continua aceito", () => {
    const result = PublicLeadFormRequestSchema.safeParse(BASE_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("null continua aceito", () => {
    const result = PublicLeadFormRequestSchema.safeParse({ ...BASE_PAYLOAD, email: null });
    expect(result.success).toBe(true);
  });

  it("e-mail válido é preservado", () => {
    const result = PublicLeadFormRequestSchema.safeParse({
      ...BASE_PAYLOAD,
      email: "cliente@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("cliente@example.com");
    }
  });

  it("e-mail malformado continua rejeitado (não virou aceita-tudo)", () => {
    const result = PublicLeadFormRequestSchema.safeParse({
      ...BASE_PAYLOAD,
      email: "nao-e-um-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Email inválido");
    }
  });
});
