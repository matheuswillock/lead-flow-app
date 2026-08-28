import { describe, expect, it } from "bun:test";
import { toUserToastMessage, USER_TOAST_GENERIC_ERROR } from "./to-user-toast-message";
import { ApiRequestError } from "@/lib/http/api-request-error";

describe("toUserToastMessage", () => {
  it("hides JSON.parse unexpected character", () => {
    expect(
      toUserToastMessage(
        new Error("JSON.parse: unexpected character at line 1 column 1 of the JSON data"),
      ),
    ).toBe(USER_TOAST_GENERIC_ERROR);
  });

  it("hides 413 Request Entity Too Large", () => {
    expect(toUserToastMessage("Request Entity Too Large")).toBe(USER_TOAST_GENERIC_ERROR);
  });

  it("hides Prisma P2002 unique constraint", () => {
    const prismaError = new Error(
      "Invalid `prisma.emailContact.create()` invocation:\nUnique constraint failed on the fields: (`email`)",
    );
    Object.assign(prismaError, { code: "P2002" });

    expect(toUserToastMessage(prismaError)).toBe(USER_TOAST_GENERIC_ERROR);
  });

  it("shows product PT-BR Output.errorMessages", () => {
    expect(toUserToastMessage("Não foi possível importar os contatos. Tente novamente.")).toBe(
      "Não foi possível importar os contatos. Tente novamente.",
    );
    expect(
      toUserToastMessage({
        errorMessages: ["Não foi possível importar os contatos. Tente novamente."],
      }),
    ).toBe("Não foi possível importar os contatos. Tente novamente.");
  });

  it("hides Error class names when product PT-BR copy is present", () => {
    const apiError = new Error("Erro ao buscar template");
    apiError.name = "ApiRequestError";

    expect(toUserToastMessage(apiError)).toBe("Erro ao buscar template");
  });

  it("hides SyntaxError and English dumps when unsure", () => {
    expect(toUserToastMessage(new SyntaxError("Unexpected token < in JSON"))).toBe(
      USER_TOAST_GENERIC_ERROR,
    );
    expect(toUserToastMessage(new Error("fetch failed"))).toBe(USER_TOAST_GENERIC_ERROR);
    expect(toUserToastMessage(undefined)).toBe(USER_TOAST_GENERIC_ERROR);
  });

  // Regressão Calli (2026-08-27): Output.errorMessages de rota nossa é sempre
  // copy de produto, mesmo sem acento e sem nenhum PRODUCT_PORTUGUESE_MARKERS —
  // "Envio de e-mail liberado apenas para o Grupo Beta de Radar no time ativo"
  // era mascarado para "Ocorreu um erro." porque a heurística de acento/marcador
  // não tem como saber a origem da string. A origem precisa vir etiquetada
  // (ApiRequestError), não adivinhada pelo conteúdo.
  it("preserva mensagem de ApiRequestError (Output do nosso backend) mesmo sem acento e sem marcador PT-BR", () => {
    const backendMessage = "Envio de e-mail liberado apenas para o Grupo Beta de Radar no time ativo";
    expect(toUserToastMessage(new ApiRequestError(backendMessage, 400))).toBe(backendMessage);
  });

  it("preserva qualquer copy futura sem acento vinda de ApiRequestError (classe do bug, não o caso específico)", () => {
    const futureBackendMessage = "Envio bloqueado para clientes sem plano corporativo ativo";
    expect(toUserToastMessage(new ApiRequestError(futureBackendMessage, 403))).toBe(
      futureBackendMessage,
    );
  });

  it("ApiRequestError NUNCA é mascarado por conteúdo, mesmo contendo substrings técnicas por coincidência", () => {
    // O ponto do fix: a decisão é pela ORIGEM (a classe), não por adivinhar o
    // conteúdo — mesmo um texto que colidiria com TECHNICAL_SUBSTRINGS deve
    // passar intacto quando vem etiquetado como erro da nossa própria rota.
    const message = "prisma não configurado corretamente para este time";
    expect(toUserToastMessage(new ApiRequestError(message, 400))).toBe(message);
  });

  it("erro técnico real (não ApiRequestError) continua mascarado, mesmo com acento/marcador coincidente", () => {
    // Guarda-costas do fix: só ApiRequestError ganha passe livre. Um TypeError
    // ou falha de rede genuínos continuam escondidos atrás da copy genérica.
    expect(toUserToastMessage(new TypeError("Cannot read properties of undefined"))).toBe(
      USER_TOAST_GENERIC_ERROR,
    );
    expect(toUserToastMessage(new Error("fetch failed"))).toBe(USER_TOAST_GENERIC_ERROR);
  });
});
