import { describe, expect, it } from "bun:test";
import { parseInboundV2Payload } from "./payload";
import {
  AVAILABILITY_PATH,
  CREATE_EXAMPLE,
  FIELD_DESCRIPTIONS,
  RESULT_CODES,
  SCHEDULE_EXAMPLE,
  WEBHOOK_V2_PATH,
  buildInboundV2JsonSchema,
  buildStudioOpenApiDocument,
} from "./contractDocs";
import { INBOUND_RESULT_CODES } from "./resultCodes";

type Node = { properties?: Record<string, Node>; required?: string[]; description?: string };

function collectPaths(node: Node, prefix = ""): string[] {
  return Object.entries(node.properties ?? {}).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...collectPaths(child, path)];
  });
}

describe("contrato v2 legível por máquina", () => {
  const schema = buildInboundV2JsonSchema() as Node & { examples: unknown[] };

  it("T-11.15: cada campo do Zod aparece no JSON Schema com descrição", () => {
    const paths = collectPaths(schema);

    expect(paths).toEqual(
      expect.arrayContaining(["lead.name", "lead.phone", "schedule.closer.profile_id", "schedule.starts_at", "assigned_to.profile_id"]),
    );
    expect(paths.filter((path) => !FIELD_DESCRIPTIONS[path])).toEqual([]);
  });

  it("marca como obrigatórios só os campos que o parser exige", () => {
    expect(schema.required).toEqual(["lead"]);
    expect(schema.properties?.lead.required).toEqual(["name", "phone"]);
    expect(schema.properties?.schedule.required).toEqual(["closer", "starts_at"]);
    expect(schema.properties?.schedule.properties?.closer.required).toEqual(["profile_id"]);
  });

  it("não publica duration_minutes e explica que a duração é a do time", () => {
    expect(JSON.stringify(schema)).not.toContain("\"duration_minutes\":{");
    expect(schema.properties?.schedule.description).toContain("duration_minutes");
  });

  it("os exemplos publicados passam no parser real", () => {
    const withCloser = { ...SCHEDULE_EXAMPLE, schedule: { ...SCHEDULE_EXAMPLE.schedule, closer: { profile_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7" } } };

    expect(parseInboundV2Payload(CREATE_EXAMPLE).ok).toBe(true);
    expect(parseInboundV2Payload(withCloser).ok).toBe(true);
  });

  it("todo código de resultado tem descrição", () => {
    expect(RESULT_CODES.map((entry) => entry.code).sort()).toEqual(Object.values(INBOUND_RESULT_CODES).sort());
    expect(RESULT_CODES.filter((entry) => entry.description.length < 10)).toEqual([]);
  });
});

describe("OpenAPI da API Studio", () => {
  const doc = buildStudioOpenApiDocument("https://app.test") as {
    openapi: string;
    servers: Array<{ url: string }>;
    paths: Record<string, Record<string, { responses: Record<string, unknown>; security: unknown[] }>>;
    components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
  };

  it("descreve os dois endpoints com segurança e respostas de erro", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0].url).toBe("https://app.test");
    expect(Object.keys(doc.paths)).toEqual([WEBHOOK_V2_PATH, AVAILABILITY_PATH]);
    expect(Object.keys(doc.paths[WEBHOOK_V2_PATH].post.responses)).toEqual(
      expect.arrayContaining(["202", "400", "401", "403", "413", "429"]),
    );
    expect(Object.keys(doc.paths[AVAILABILITY_PATH].get.responses)).toEqual(
      expect.arrayContaining(["200", "400", "401", "403", "429"]),
    );
    expect(Object.keys(doc.components.securitySchemes)).toEqual(["webhookToken", "availabilityToken"]);
  });

  it("não carrega dado de time nem segredo", () => {
    const text = JSON.stringify(doc);

    expect(text).not.toMatch(/cs_avail_[0-9a-f]{16}/);
    expect(text).not.toMatch(/Bearer [A-Za-z0-9]{20,}/);
  });
});
