import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

const revalidatedTags: string[] = [];

mock.module("next/cache", () => ({
  revalidateTag: mock((tag: string) => {
    revalidatedTags.push(tag);
  }),
}));

const {
  invalidateLeadCache,
  invalidateLeadFullCache,
  invalidateTeamCalendarCache,
  invalidateTeamLeadsCache,
  invalidateTeamMembersCache,
  invalidateHealthPlansCache,
  invalidatePublicFormBootstrapCache,
  invalidateNotificationsCache,
} = await import("./invalidation");

beforeEach(() => {
  revalidatedTags.length = 0;
});

describe("invalidateLeadCache", () => {
  it("derruba o lead, o board e o calendario do time", () => {
    invalidateLeadCache({ leadId: "lead-1", teamId: "team-1" });

    expect(new Set(revalidatedTags)).toEqual(
      new Set([
        "lead:lead-1",
        "lead-details:lead-1",
        "team-leads:team-1",
        "team-calendar:team-1",
        "team-dashboard:team-1",
        "team-performance:team-1",
      ])
    );
  });

  it("cobre o time anterior quando o lead muda de time", () => {
    invalidateLeadCache({ leadId: "lead-1", teamId: "team-1", previousTeamId: "team-0" });

    expect(revalidatedTags).toContain("team-leads:team-0");
    expect(revalidatedTags).toContain("team-calendar:team-0");
    expect(revalidatedTags).toContain("team-dashboard:team-0");
    expect(revalidatedTags).toContain("team-performance:team-0");
  });

  it("ignora previousTeamId nulo sem emitir tag vazia", () => {
    invalidateLeadCache({ leadId: "lead-1", teamId: "team-1", previousTeamId: null });

    expect(revalidatedTags.every((tag) => Boolean(tag))).toBe(true);
    expect(revalidatedTags.filter((tag) => tag.startsWith("team-leads:"))).toEqual([
      "team-leads:team-1",
    ]);
  });
});

describe("invalidateLeadFullCache", () => {
  it("adiciona atividades e agendamentos ao conjunto do invalidateLeadCache", () => {
    invalidateLeadFullCache({ leadId: "lead-1", teamId: "team-1" });

    expect(revalidatedTags).toContain("lead-activities:lead-1");
    expect(revalidatedTags).toContain("lead-schedules:lead-1");
    expect(revalidatedTags).toContain("team-calendar:team-1");
  });
});

describe("invalidateTeamCalendarCache", () => {
  it("derruba calendario, board, dashboard e performance do time", () => {
    invalidateTeamCalendarCache({ teamId: "team-1" });

    expect(new Set(revalidatedTags)).toEqual(
      new Set([
        "team-calendar:team-1",
        "team-leads:team-1",
        "team-dashboard:team-1",
        "team-performance:team-1",
      ])
    );
  });

  it("inclui team-leads porque agendar grava meetingDate na propria Lead", () => {
    // Simetria com invalidateLeadCache, que ja derruba team-calendar. Sem isto
    // o board mostrava horario de reuniao velho ate o TTL.
    invalidateTeamCalendarCache({ teamId: "team-1" });

    expect(revalidatedTags).toContain("team-leads:team-1");
  });

  it("inclui as tags do lead quando leadId e informado", () => {
    invalidateTeamCalendarCache({ teamId: "team-1", leadId: "lead-9" });

    expect(revalidatedTags).toContain("lead:lead-9");
    expect(revalidatedTags).toContain("lead-details:lead-9");
    expect(revalidatedTags).toContain("lead-schedules:lead-9");
  });
});

describe("invalidateTeamLeadsCache", () => {
  it("derruba board, dashboard e performance do time", () => {
    invalidateTeamLeadsCache({ teamId: "team-1" });

    expect(new Set(revalidatedTags)).toEqual(
      new Set(["team-leads:team-1", "team-dashboard:team-1", "team-performance:team-1"])
    );
  });
});

describe("invalidatePublicFormBootstrapCache", () => {
  it("derruba apenas o bootstrap do formulario publico do time", () => {
    invalidatePublicFormBootstrapCache({ teamId: "team-1" });

    expect(revalidatedTags).toEqual(["public-form-bootstrap:team-1"]);
  });
});

describe("invalidateTeamMembersCache", () => {
  it("derruba a tag de membros, que o bootstrap publico co-declara", () => {
    invalidateTeamMembersCache({ teamId: "team-1" });

    expect(revalidatedTags).toEqual(["team-members:team-1"]);
  });
});

describe("invalidateHealthPlansCache", () => {
  it("derruba a tag global de planos de saude", () => {
    invalidateHealthPlansCache();

    expect(revalidatedTags).toEqual(["health-plans"]);
  });
});

describe("invalidateNotificationsCache", () => {
  it("emite uma tag por destinatario", () => {
    invalidateNotificationsCache({ recipientProfileIds: ["p-1", "p-2"] });

    expect(revalidatedTags).toEqual(["notifications:p-1", "notifications:p-2"]);
  });

  it("nao emite nada para lista vazia", () => {
    invalidateNotificationsCache({ recipientProfileIds: [] });

    expect(revalidatedTags).toEqual([]);
  });
});
