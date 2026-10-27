import { describe, expect, it } from "bun:test";
import { parseInboundV2Payload } from "@/lib/webhooks/inbound/v2/payload";
import {
  BODY_FIELDS,
  CREATE_BODY,
  SCHEDULE_BODY,
  buildCurlAvailability,
  buildCurlCreate,
  buildCurlSchedule,
  TOKEN_PLACEHOLDER,
} from "./inboundV2Guide";

/**
 * O guia mostrado no app precisa descrever o contrato que o parser aceita de verdade:
 * os exemplos passam no parser real e `duration_minutes` não aparece em lugar nenhum.
 */
const VALID_CLOSER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("guia do webhook de entrada v2", () => {
  it("o exemplo sem agendamento é aceito pelo parser sem campos ignorados", () => {
    const result = parseInboundV2Payload(CREATE_BODY);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ignoredFields).toEqual([]);
  });

  it("o exemplo com agendamento é aceito pelo parser (trocando só o UUID do closer)", () => {
    const body = { ...SCHEDULE_BODY, schedule: { ...SCHEDULE_BODY.schedule, closer: { profile_id: VALID_CLOSER_ID } } };

    const result = parseInboundV2Payload(body);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ignoredFields).toEqual([]);
  });

  it("não ensina duration_minutes nos exemplos nem na tabela de campos", () => {
    const text = [buildCurlCreate("https://x.test/w"), buildCurlSchedule("https://x.test/w"), JSON.stringify(BODY_FIELDS)].join("\n");

    expect(text).not.toContain("duration_minutes");
  });

  it("usa apenas o placeholder no lugar do token e a URL recebida", () => {
    const curl = buildCurlSchedule("https://app.test/api/webhooks/studio/v2/team-1");

    expect(curl).toContain("https://app.test/api/webhooks/studio/v2/team-1");
    expect(curl).toContain(`Bearer ${TOKEN_PLACEHOLDER}`);
    expect(buildCurlAvailability("https://app.test")).toContain("/api/studio/v1/availability");
  });

  it("o JSON do curl é o mesmo corpo validado", () => {
    const curl = buildCurlCreate("https://x.test/w");
    const json = curl.slice(curl.indexOf("-d '") + 4, curl.lastIndexOf("'"));

    expect(JSON.parse(json)).toEqual(CREATE_BODY);
  });
});
