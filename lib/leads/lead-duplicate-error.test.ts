import { describe, expect, it } from "bun:test";
import { Prisma } from "@prisma/client";
import {
  OPEN_LEAD_CNPJ_DUPLICATE_MESSAGE,
  OPEN_LEAD_EMAIL_DUPLICATE_MESSAGE,
  describeOpenLeadDuplicateError,
} from "./lead-duplicate-error";

function p2002(target: unknown) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("describeOpenLeadDuplicateError", () => {
  it("reconhece e-mail pelo nome do índice parcial", () => {
    expect(describeOpenLeadDuplicateError(p2002("corretor_studio_leads_teamId_email_open_key"))).toBe(
      OPEN_LEAD_EMAIL_DUPLICATE_MESSAGE,
    );
  });

  it("reconhece CNPJ pelo nome do índice parcial", () => {
    expect(describeOpenLeadDuplicateError(p2002("corretor_studio_leads_teamId_cnpj_open_key"))).toBe(
      OPEN_LEAD_CNPJ_DUPLICATE_MESSAGE,
    );
  });

  it("reconhece as colunas quando o alvo vem como lista", () => {
    expect(describeOpenLeadDuplicateError(p2002(["teamId", "cnpj"]))).toBe(OPEN_LEAD_CNPJ_DUPLICATE_MESSAGE);
    expect(describeOpenLeadDuplicateError(p2002(["teamId", "email"]))).toBe(OPEN_LEAD_EMAIL_DUPLICATE_MESSAGE);
  });

  it("ignora P2002 de outro campo e erros que não são do Prisma", () => {
    expect(describeOpenLeadDuplicateError(p2002(["leadCode"]))).toBeNull();
    expect(describeOpenLeadDuplicateError(new Error("boom"))).toBeNull();
  });
});
