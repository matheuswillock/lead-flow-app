import { describe, expect, it } from "bun:test";
import { buildTransferTargetItems } from "./build-transfer-target-items";

describe("buildTransferTargetItems", () => {
  const internalTargets = [{ teamId: "team-cpr", teamName: "CPR" }];
  const externalTargets = [
    {
      masterId: "target-master",
      masterName: "Conta Destino",
      masterEmail: "destino@example.com",
      defaultTeamId: "team-dest",
      defaultTeamName: "Time Destino",
      closers: [{ profileId: "closer-1", fullName: "Closer 1", email: "closer@example.com" }],
    },
  ];

  it("retorna somente destinos internos quando canExternalMultiskill é false", () => {
    const result = buildTransferTargetItems({
      internalTargets,
      externalTargets,
      canExternalMultiskill: false,
      page: 1,
      pageSize: 20,
    });

    expect(result.canExternalMultiskill).toBe(false);
    expect(result.items).toEqual([
      { teamId: "team-cpr", teamName: "CPR", mode: "internal" },
    ]);
  });

  it("une destinos internos e externos quando canExternalMultiskill é true", () => {
    const result = buildTransferTargetItems({
      internalTargets,
      externalTargets,
      canExternalMultiskill: true,
      page: 1,
      pageSize: 20,
    });

    expect(result.canExternalMultiskill).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ teamId: "team-cpr", mode: "internal" });
    expect(result.items[1]).toMatchObject({
      teamId: "team-dest",
      mode: "multiskill",
      masterId: "target-master",
      closers: [{ profileId: "closer-1" }],
    });
  });

  it("pagina resultados unificados", () => {
    const result = buildTransferTargetItems({
      internalTargets: [
        { teamId: "team-a", teamName: "A" },
        { teamId: "team-b", teamName: "B" },
        { teamId: "team-c", teamName: "C" },
      ],
      externalTargets: null,
      canExternalMultiskill: false,
      page: 2,
      pageSize: 2,
    });

    expect(result.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.teamId).toBe("team-c");
  });
});
