import { expect, mock, test } from "bun:test";
import { Output } from "@/lib/output";
import { SetActiveTeamUseCase } from "./SetActiveTeamUseCase";

const teamId = "11111111-1111-4111-8111-111111111111";

function buildSut(overrides?: {
  profile?: { id: string } | null;
  membershipTeam?: { deletedAt: Date | null } | null;
  sponsored?: { sponsorMasterId: string | null } | null;
  decision?: Output;
  supportTeam?: { id: string } | null;
}) {
  const profileRepository = {
    findBySupabaseId: mock(
      async () =>
        overrides && "profile" in overrides ? overrides.profile : { id: "profile-1" }
    ),
    updateActiveTeamId: mock(async () => {}),
  };
  const teamMembersRepository = {
    findMembershipTeamState: mock(
      async () =>
        overrides && "membershipTeam" in overrides
          ? overrides.membershipTeam
          : { deletedAt: null }
    ),
    findSponsoredTeamAccess: mock(
      async () => (overrides && "sponsored" in overrides ? overrides.sponsored : null)
    ),
  };
  const accountAccess = {
    execute: mock(
      async () =>
        overrides?.decision ??
        new Output(true, [], [], { state: "allowed" })
    ),
  };
  const supportAccess = {
    enterTeam: mock(async () =>
      overrides && "supportTeam" in overrides ? overrides.supportTeam : null
    ),
  };
  const sut = new SetActiveTeamUseCase(
    profileRepository as never,
    teamMembersRepository as never,
    accountAccess,
    supportAccess
  );
  return { sut, profileRepository, teamMembersRepository, accountAccess, supportAccess };
}

test("troca para time com membership e persiste o time ativo", async () => {
  const { sut, profileRepository } = buildSut();
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(true);
  expect(output.result?.activeTeamId).toBe(teamId);
  expect(profileRepository.updateActiveTeamId).toHaveBeenCalledWith("profile-1", teamId);
});

test("troca para time patrocinado sem membership", async () => {
  const { sut, profileRepository } = buildSut({
    membershipTeam: null,
    sponsored: { sponsorMasterId: "profile-1" },
  });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(true);
  expect(profileRepository.updateActiveTeamId).toHaveBeenCalledWith("profile-1", teamId);
});

test("recusa time sem membership nem patrocínio", async () => {
  const { sut, profileRepository } = buildSut({
    membershipTeam: null,
    sponsored: { sponsorMasterId: "other-profile" },
  });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(false);
  expect(output.errorMessages).toContain("NOT_TEAM_MEMBER");
  expect(profileRepository.updateActiveTeamId).not.toHaveBeenCalled();
});

test("Manager do backoffice entra em qualquer conta sem passar pela cobrança", async () => {
  const { sut, profileRepository, accountAccess, supportAccess } = buildSut({
    membershipTeam: null,
    sponsored: { sponsorMasterId: null },
    supportTeam: { id: teamId },
    decision: new Output(true, [], [], { state: "restricted", reason: "past_due" }),
  });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(true);
  expect(output.result?.accountAccessDecision).toEqual({ state: "allowed" });
  expect(supportAccess.enterTeam).toHaveBeenCalledWith("profile-1", teamId);
  expect(accountAccess.execute).not.toHaveBeenCalled();
  expect(profileRepository.updateActiveTeamId).toHaveBeenCalledWith("profile-1", teamId);
});

test("quem não é Manager do backoffice continua recusado", async () => {
  const { sut, profileRepository, supportAccess } = buildSut({
    membershipTeam: null,
    sponsored: { sponsorMasterId: null },
    supportTeam: null,
  });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(false);
  expect(output.errorMessages).toContain("NOT_TEAM_MEMBER");
  expect(supportAccess.enterTeam).toHaveBeenCalledTimes(1);
  expect(profileRepository.updateActiveTeamId).not.toHaveBeenCalled();
});

test("time inexistente nem chega a consultar o suporte", async () => {
  const { sut, supportAccess } = buildSut({ membershipTeam: null, sponsored: null });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(false);
  expect(supportAccess.enterTeam).not.toHaveBeenCalled();
});

test("recusa perfil inexistente", async () => {
  const { sut } = buildSut({ profile: null });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(false);
  expect(output.errorMessages).toContain("PROFILE_NOT_FOUND");
});

test("falha quando a decisão de acesso não resolve", async () => {
  const { sut, profileRepository } = buildSut({
    decision: new Output(false, [], ["Erro"], null),
  });
  const output = await sut.execute({ supabaseId: "sup-1", teamId });

  expect(output.isValid).toBe(false);
  expect(output.errorMessages).toContain("ACCESS_UNRESOLVABLE");
  expect(profileRepository.updateActiveTeamId).not.toHaveBeenCalled();
});
