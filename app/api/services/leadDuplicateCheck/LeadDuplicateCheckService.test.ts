import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

const findDuplicateDirectMatchesMock = mock(async () => [] as Array<{
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: null;
  createdAt: Date;
}>);
const findDuplicateScanCandidatesMock = mock(async () => [] as Array<{
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: null;
  createdAt: Date;
}>);

const { LeadDuplicateCheckService } = await import("./LeadDuplicateCheckService");

const ctx: TeamContext = {
  profileId: "profile-1",
  teamMember: { role: "manager", functions: [] },
};

describe("LeadDuplicateCheckService", () => {
  beforeEach(() => {
    findDuplicateDirectMatchesMock.mockReset();
    findDuplicateScanCandidatesMock.mockReset();
    findDuplicateDirectMatchesMock.mockResolvedValue([]);
    findDuplicateScanCandidatesMock.mockResolvedValue([]);
  });

  it("normaliza telefone com máscara BR e encontra candidato legado", async () => {
    findDuplicateScanCandidatesMock.mockResolvedValueOnce([
      {
        id: "lead-1",
        leadCode: "LF-001",
        name: "Maria",
        phone: "11988887777",
        email: null,
        status: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const service = new LeadDuplicateCheckService({
      findDuplicateDirectMatches: findDuplicateDirectMatchesMock,
      findDuplicateScanCandidates: findDuplicateScanCandidatesMock,
    } as never);
    const candidates = await service.findCandidates(ctx, {
      teamId: "team-1",
      phone: "+55 (11) 98888-7777",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.leadCode).toBe("LF-001");
  });

  it("normaliza e-mail com maiúsculas e encontra candidato", async () => {
    findDuplicateScanCandidatesMock.mockResolvedValueOnce([
      {
        id: "lead-2",
        leadCode: "LF-002",
        name: "João",
        phone: null,
        email: "joao@email.com",
        status: null,
        createdAt: new Date("2026-01-02"),
      },
    ]);

    const service = new LeadDuplicateCheckService({
      findDuplicateDirectMatches: findDuplicateDirectMatchesMock,
      findDuplicateScanCandidates: findDuplicateScanCandidatesMock,
    } as never);
    const candidates = await service.findCandidates(ctx, {
      teamId: "team-1",
      email: "JOAO@EMAIL.COM",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe("lead-2");
  });

  it("retorna vazio quando telefone e e-mail estão ausentes", async () => {
    const service = new LeadDuplicateCheckService({
      findDuplicateDirectMatches: findDuplicateDirectMatchesMock,
      findDuplicateScanCandidates: findDuplicateScanCandidatesMock,
    } as never);
    const candidates = await service.findCandidates(ctx, {
      teamId: "team-1",
    });

    expect(candidates).toEqual([]);
    expect(findDuplicateDirectMatchesMock).not.toHaveBeenCalled();
    expect(findDuplicateScanCandidatesMock).not.toHaveBeenCalled();
  });
});
