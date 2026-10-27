import { describe, expect, it } from "bun:test";
import type { TeamMemberOption } from "../services/ITeamWebhooksService";
import { buildCreateV2Href, buildOverviewAssignees, describeScopes, suggestV2Name } from "./inboundV2Overview";

const member = (profileId: string, name: string): TeamMemberOption => ({ profileId, name, functions: ["SDR"], googleCalendarConnected: true });
const members = [member("a", "Ana"), member("b", "Bruno"), member("c", "Carla")];

describe("inboundV2Overview", () => {
  it("traduz os escopos e mantém o desconhecido como veio", () => {
    expect(describeScopes(["leads_create", "leads_schedule", "novo"])).toEqual(["Criar leads", "Agendar reuniões", "novo"]);
  });

  it("marca o próximo SDR a partir do último atendido, na ordem do rodízio", () => {
    const result = buildOverviewAssignees({ assigneeProfileIds: ["a", "b", "c"], lastAssignedProfileId: "a", members });

    expect(result.map((row) => [row.name, row.isNext])).toEqual([["Ana", false], ["Bruno", true], ["Carla", false]]);
  });

  it("no primeiro uso o próximo é o primeiro da lista", () => {
    const result = buildOverviewAssignees({ assigneeProfileIds: ["b", "c"], lastAssignedProfileId: null, members });

    expect(result[0]).toMatchObject({ name: "Bruno", isNext: true });
  });

  it("pula quem saiu do time e o lista como fora do time", () => {
    const result = buildOverviewAssignees({ assigneeProfileIds: ["a", "x", "c"], lastAssignedProfileId: "a", members });

    expect(result.map((row) => [row.name, row.isNext])).toEqual([["Ana", false], ["Fora do time", false], ["Carla", true]]);
  });

  it("sem SDR padrão não há próximo", () => {
    expect(buildOverviewAssignees({ assigneeProfileIds: [], lastAssignedProfileId: null, members })).toEqual([]);
  });

  it("sugere o nome do v2 sem duplicar o sufixo e monta o link de criação", () => {
    expect(suggestV2Name("YouPop")).toBe("YouPop (v2)");
    expect(suggestV2Name("YouPop v2")).toBe("YouPop v2");
    expect(buildCreateV2Href("/sid/integrations/webhooks/inbound", "Meu hook")).toBe(
      "/sid/integrations/webhooks/inbound/new?from_name=Meu%20hook%20(v2)",
    );
  });
});
