import { beforeEach, describe, expect, it, mock } from "bun:test";

type FindFirstArgs = { where: Record<string, unknown> };

const findFirstMock = mock(async (_args: FindFirstArgs) => null as { id: string } | null);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { lead: { findFirst: findFirstMock } },
}));

const { LeadRepository } = await import("./LeadRepository");

/**
 * SPEC 11, D41: o e-mail/CNPJ só é "único" entre leads não deletados que ainda estão em aberto para o
 * contato (sem status, nova oportunidade ou agendado). Os pré-checks de conflito precisam espelhar o
 * índice único parcial do banco; senão bloqueiam justamente o "lead novo para contato que já
 * foi perdido/finalizado" que o webhook v2 promete.
 */
const OPEN_UNIQUENESS_CLAUSES = [
  { deletedAt: null },
  { OR: [{ status: null }, { status: { in: ["new_opportunity", "scheduled"] } }] },
];

describe("LeadRepository — conflitos de e-mail e CNPJ espelham o índice único parcial (D41)", () => {
  beforeEach(() => {
    findFirstMock.mockClear();
  });

  it("findCnpjConflictInTeam ignora lead deletado e lead fora de nova oportunidade/agendado", async () => {
    await new LeadRepository().findCnpjConflictInTeam({ teamId: "team-1", cnpj: "12345678000190" });

    const where = findFirstMock.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ teamId: "team-1", cnpj: "12345678000190" });
    expect(where?.AND).toEqual(OPEN_UNIQUENESS_CLAUSES);
  });

  it("findEmailConflictInTeam ignora lead deletado e lead fora de nova oportunidade/agendado", async () => {
    await new LeadRepository().findEmailConflictInTeam({ teamId: "team-1", email: "ana@exemplo.com" });

    const where = findFirstMock.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ teamId: "team-1", email: "ana@exemplo.com" });
    expect(where?.AND).toEqual(OPEN_UNIQUENESS_CLAUSES);
  });

  it("continua excluindo o próprio lead na edição", async () => {
    await new LeadRepository().findCnpjConflictInTeam({
      teamId: "team-1",
      cnpj: "12345678000190",
      excludeLeadId: "lead-9",
    });

    const where = findFirstMock.mock.calls[0]?.[0].where;
    expect(where).toMatchObject({ NOT: { id: "lead-9" } });
    expect(where?.AND).toEqual(OPEN_UNIQUENESS_CLAUSES);
  });
});
