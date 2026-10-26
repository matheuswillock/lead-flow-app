import { describe, expect, it } from "bun:test";
import { parseInboundV2Payload } from "./payload";

const valid = {
  external_id: "evento-123",
  lead: { name: "Maria Souza", phone: "+5511999998888", email: "maria@exemplo.com", notes: "Retorno à tarde" },
  source: "3cplus",
};

describe("parseInboundV2Payload — campos do guia", () => {
  it("aceita o mínimo do guia: lead.name e lead.phone (e-mail é opcional)", () => {
    const result = parseInboundV2Payload({ lead: { name: "Maria", phone: "11999998888" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lead).toEqual({ name: "Maria", phone: "11999998888" });
      expect(result.data.schedule).toBeUndefined();
    }
  });

  it("normaliza espaços e trata e-mail vazio como ausente", () => {
    const result = parseInboundV2Payload({ lead: { name: "  Maria  ", phone: " 11999998888 ", email: "  " } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.lead.name).toBe("Maria");
      expect(result.data.lead.phone).toBe("11999998888");
      expect(result.data.lead.email).toBeUndefined();
    }
  });

  it("sem lead.name ou sem lead.phone o evento é inválido, listando só o caminho do campo", () => {
    const missingName = parseInboundV2Payload({ lead: { phone: "11999998888" } });
    const missingPhone = parseInboundV2Payload({ lead: { name: "Maria" } });
    expect(missingName.ok).toBe(false);
    expect(missingPhone.ok).toBe(false);
    if (!missingName.ok) expect(missingName.issues.map((issue) => issue.path)).toContain("lead.name");
    if (!missingPhone.ok) expect(missingPhone.issues.map((issue) => issue.path)).toContain("lead.phone");
  });

  it("a mensagem de erro nunca repete o valor recebido", () => {
    const result = parseInboundV2Payload({ lead: { name: "Maria", phone: "11999998888", email: "isto-nao-e-email" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(JSON.stringify(result.issues)).not.toContain("isto-nao-e-email");
  });
});

describe("parseInboundV2Payload — campos desconhecidos (T-11.14)", () => {
  it("são aceitos, ignorados e listados em ignoredFields, inclusive os aninhados", () => {
    const result = parseInboundV2Payload({
      ...valid,
      campo_novo: 1,
      lead: { ...valid.lead, apelido: "Mari" },
      schedule: {
        closer: { profile_id: "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69", nome: "Ana" },
        starts_at: "2026-11-03T14:00:00-03:00",
        sala: "3",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.ignoredFields].sort()).toEqual(
        ["campo_novo", "lead.apelido", "schedule.closer.nome", "schedule.sala"].sort(),
      );
      expect(result.data).not.toHaveProperty("campo_novo");
    }
  });

  it("não lista nada quando o corpo só tem campos conhecidos", () => {
    const result = parseInboundV2Payload(valid);
    expect(result.ok && result.ignoredFields).toEqual([]);
  });

  it("metadata é livre: o conteúdo dele não vira campo ignorado", () => {
    const result = parseInboundV2Payload({ ...valid, metadata: { qualquer: { coisa: 1 } } });
    expect(result.ok && result.ignoredFields).toEqual([]);
  });
});

describe("parseInboundV2Payload — schedule", () => {
  const closer = { profile_id: "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69" };

  it("aceita starts_at RFC 3339 com offset e tipos válidos", () => {
    for (const type of ["online", "call", "whatsapp"]) {
      const result = parseInboundV2Payload({ ...valid, schedule: { closer, starts_at: "2026-11-03T14:00:00-03:00", type } });
      expect(result.ok).toBe(true);
    }
  });

  it("recusa starts_at sem offset (ambíguo) e tipo desconhecido", () => {
    expect(parseInboundV2Payload({ ...valid, schedule: { closer, starts_at: "2026-11-03T14:00:00" } }).ok).toBe(false);
    expect(parseInboundV2Payload({ ...valid, schedule: { closer, starts_at: "03/11/2026 14:00" } }).ok).toBe(false);
    expect(
      parseInboundV2Payload({ ...valid, schedule: { closer, starts_at: "2026-11-03T14:00:00Z", type: "teams" } }).ok,
    ).toBe(false);
  });

  it("duration_minutes é aceito mas não é obrigatório: a duração é a configurada no time", () => {
    const withoutDuration = parseInboundV2Payload({ ...valid, schedule: { closer, starts_at: "2026-11-03T14:00:00Z" } });
    const withDuration = parseInboundV2Payload({
      ...valid,
      schedule: { closer, starts_at: "2026-11-03T14:00:00Z", duration_minutes: 45 },
    });
    expect(withoutDuration.ok).toBe(true);
    expect(withDuration.ok).toBe(true);
    if (withDuration.ok) expect(withDuration.ignoredFields).toContain("schedule.duration_minutes");
  });

  it("limita os convidados a 3 e exige e-mails válidos", () => {
    const base = { closer, starts_at: "2026-11-03T14:00:00Z" };
    expect(parseInboundV2Payload({ ...valid, schedule: { ...base, guests: ["a@x.com", "b@x.com", "c@x.com"] } }).ok).toBe(true);
    expect(
      parseInboundV2Payload({ ...valid, schedule: { ...base, guests: ["a@x.com", "b@x.com", "c@x.com", "d@x.com"] } }).ok,
    ).toBe(false);
    expect(parseInboundV2Payload({ ...valid, schedule: { ...base, guests: ["nao-e-email"] } }).ok).toBe(false);
  });

  it("exige closer.profile_id em UUID", () => {
    const result = parseInboundV2Payload({
      ...valid,
      schedule: { closer: { profile_id: "closer-1" }, starts_at: "2026-11-03T14:00:00Z" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseInboundV2Payload — assigned_to e corpo", () => {
  it("aceita assigned_to.profile_id em UUID e recusa outro formato", () => {
    const ok = parseInboundV2Payload({ ...valid, assigned_to: { profile_id: "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69" } });
    const bad = parseInboundV2Payload({ ...valid, assigned_to: { profile_id: "sdr-1" } });
    expect(ok.ok).toBe(true);
    expect(bad.ok).toBe(false);
  });

  it("corpo que não é objeto é inválido", () => {
    expect(parseInboundV2Payload([]).ok).toBe(false);
    expect(parseInboundV2Payload("texto").ok).toBe(false);
    expect(parseInboundV2Payload(null).ok).toBe(false);
  });
});
