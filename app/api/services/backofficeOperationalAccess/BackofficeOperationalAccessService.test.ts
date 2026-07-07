import { describe, expect, it } from "bun:test";
import { BackofficeOperationalAccessService } from "./BackofficeOperationalAccessService";
import type { IBackofficeOperationalAccessRepository } from "@/app/api/infra/data/repositories/backofficeOperationalAccess/IBackofficeOperationalAccessRepository";
import { BackofficeOperationalCapability } from "@prisma/client";
import { MULTISKILL_TEAM_NAME } from "@/lib/multiskill/constants";

function createRepositoryMock(
  overrides: Partial<IBackofficeOperationalAccessRepository> = {}
): IBackofficeOperationalAccessRepository {
  return {
    findProfileById: async () => null,
    findTeamById: async () => null,
    findMultiskillTeamByMasterId: async () => null,
    createMultiskillTeam: async () => ({ id: "team-new" }),
    hasActiveGrant: async () => false,
    listByCapability: async () => [],
    listEligibleMasters: async () => [],
    listEligibleMastersForMultiskill: async () => [],
    grantAssociadosQueue: async () => ({
      id: "grant-1",
      capability: BackofficeOperationalCapability.ASSOCIADOS_QUEUE,
      profileId: "profile-1",
      teamId: null,
      isActive: true,
      notes: null,
      grantedByProfileId: "admin",
      grantedAt: new Date(),
      revokedByProfileId: null,
      revokedAt: null,
      profile: null,
      team: null,
      grantedBy: null,
      revokedBy: null,
    }),
    grantMultiskillOrigin: async () => ({
      id: "grant-ms",
      capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
      profileId: null,
      teamId: "team-1",
      isActive: true,
      notes: null,
      grantedByProfileId: "admin",
      grantedAt: new Date(),
      revokedByProfileId: null,
      revokedAt: null,
      profile: null,
      team: null,
      grantedBy: null,
      revokedBy: null,
    }),
    revoke: async () => null,
    findActiveMultiskillGrantByTeamId: async () => null,
    provisionMultiskillOriginGrant: async () => ({
      id: "grant-ms-provisioned",
      capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
      profileId: null,
      teamId: "team-1",
      isActive: true,
      notes: null,
      grantedByProfileId: "admin",
      grantedAt: new Date(),
      revokedByProfileId: null,
      revokedAt: null,
      profile: null,
      team: null,
      grantedBy: null,
      revokedBy: null,
    }),
    ...overrides,
  };
}

describe("BackofficeOperationalAccessService", () => {
  it("ensureMultiskillOriginTeam reutiliza time existente", async () => {
    const service = new BackofficeOperationalAccessService(
      createRepositoryMock({
        findMultiskillTeamByMasterId: async (masterId, teamName) => {
          expect(masterId).toBe("master-1");
          expect(teamName).toBe(MULTISKILL_TEAM_NAME);
          return { id: "team-existing" };
        },
      })
    );

    const result = await service.ensureMultiskillOriginTeam("master-1");
    expect(result).toEqual({ teamId: "team-existing", created: false });
  });

  it("ensureMultiskillOriginTeam cria time quando ausente", async () => {
    const service = new BackofficeOperationalAccessService(
      createRepositoryMock({
        findMultiskillTeamByMasterId: async () => null,
        createMultiskillTeam: async (masterId, teamName) => {
          expect(masterId).toBe("master-2");
          expect(teamName).toBe(MULTISKILL_TEAM_NAME);
          return { id: "team-created" };
        },
      })
    );

    const result = await service.ensureMultiskillOriginTeam("master-2");
    expect(result).toEqual({ teamId: "team-created", created: true });
  });

  it("assertAssociadosQueueAccess nega sem grant", async () => {
    const service = new BackofficeOperationalAccessService(
      createRepositoryMock({
        hasActiveGrant: async () => false,
      })
    );

    await expect(service.assertAssociadosQueueAccess("profile-1")).rejects.toThrow(
      "Acesso restrito à fila Associados"
    );
  });

  it("assertMultiskillOriginTeam nega time não autorizado", async () => {
    const service = new BackofficeOperationalAccessService(
      createRepositoryMock({
        hasActiveGrant: async () => false,
      })
    );

    await expect(service.assertMultiskillOriginTeam("team-x")).rejects.toThrow(
      "Acesso negado: time não autorizado para transferência MultiSkill"
    );
  });

  it("grantAssociadosQueue exige master válido", async () => {
    const service = new BackofficeOperationalAccessService(
      createRepositoryMock({
        findProfileById: async () => null,
      })
    );

    const result = await service.grantAssociadosQueue({
      profileId: "invalid",
      grantedByProfileId: "admin",
    });

    expect(result).toEqual({ error: "Selecione um master válido" });
  });
});
