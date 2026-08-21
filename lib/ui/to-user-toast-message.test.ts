import { describe, expect, it } from "bun:test";
import { toUserToastMessage, USER_TOAST_GENERIC_ERROR } from "./to-user-toast-message";

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
});
