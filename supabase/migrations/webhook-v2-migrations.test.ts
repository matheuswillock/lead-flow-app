import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Contrato do SQL das migrations do webhook v2 / API Studio / D41 (SPEC 11 e 14).
 *
 * Existe porque o replay num Postgres real só roda na pipeline: aqui travamos o que um
 * `db:migrate:from-prisma` ou uma edição descuidada poderiam desfazer em silêncio (RLS das
 * tabelas novas, o predicado do índice parcial, o enum em arquivo próprio).
 */
const read = (name: string) => readFileSync(join(__dirname, name), "utf-8");

const ENUM_MIGRATION = "20261026140000_webhook-v2-notification-type.sql";
const TABLES_MIGRATION = "20261026140100_webhook-v2-inbound-events-and-api-studio.sql";
const INDEX_MIGRATION = "20261026140200_lead-partial-unique-email-cnpj.sql";

const NEW_TABLES = [
  "corretor_studio_team_webhook_inbound_events",
  "corretor_studio_lead_reschedule_alerts",
  "corretor_studio_team_api_resource_activations",
];

describe("migrations do webhook v2 — tabelas novas", () => {
  const sql = read(TABLES_MIGRATION);

  for (const table of NEW_TABLES) {
    it(`${table}: RLS ligado, sem acesso anon/authenticated e política só service_role`, () => {
      expect(sql).toContain(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(`REVOKE ALL ON TABLE "public"."${table}" FROM PUBLIC, anon, authenticated;`);
      expect(sql).toContain(`GRANT ALL ON TABLE "public"."${table}" TO service_role;`);
      expect(sql).toMatch(new RegExp(`CREATE POLICY "${table}_service_role_only"[\\s\\S]*?FOR ALL TO service_role`));
    });
  }

  it("a idempotência do evento é uma unique por webhook + chave", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "corretor_studio_team_webhook_inbound_events_webhookId_idemp_key"\s+ON "public"\."corretor_studio_team_webhook_inbound_events" \("webhookId", "idempotencyKey"\)/,
    );
  });

  it("o token da API Studio é único globalmente (o time vem do token)", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "corretor_studio_team_api_resource_activations_tokenHash_key"');
  });

  it("os webhooks existentes (v1) nascem só com o escopo leads_create", () => {
    expect(sql).toContain(`"scopes" TEXT[] DEFAULT ARRAY['leads_create']::TEXT[]`);
  });
});

describe("migration do enum de notificação", () => {
  it("só altera o enum, sem usar o valor novo na mesma transação", () => {
    const sql = read(ENUM_MIGRATION);
    const statements = sql
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("--"));
    expect(statements).toEqual([
      "ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'LEAD_NEEDS_RESCHEDULE';",
    ]);
  });
});

describe("migration D41 — unique parcial de e-mail e CNPJ por time", () => {
  const sql = read(INDEX_MIGRATION);
  const predicate = `"deletedAt" IS NULL AND ("status" IS NULL OR "status" IN ('new_opportunity', 'scheduled'))`;

  it("troca os uniques totais por uniques parciais (lixeira e leads encerrados não bloqueiam)", () => {
    expect(sql).toContain('DROP INDEX IF EXISTS "public"."corretor_studio_leads_teamId_email_key";');
    expect(sql).toContain('DROP INDEX IF EXISTS "public"."corretor_studio_leads_teamId_cnpj_key";');
    expect(sql).toMatch(
      new RegExp(
        `CREATE UNIQUE INDEX "corretor_studio_leads_teamId_email_open_key"[\\s\\S]*?\\("teamId", "email"\\)\\s+WHERE ${predicate.replace(/[()]/g, "\\$&")}`,
      ),
    );
    expect(sql).toMatch(
      new RegExp(
        `CREATE UNIQUE INDEX "corretor_studio_leads_teamId_cnpj_open_key"[\\s\\S]*?\\("teamId", "cnpj"\\)\\s+WHERE ${predicate.replace(/[()]/g, "\\$&")}`,
      ),
    );
  });

  it("nunca recria um unique total (controle negativo: quem recria desfaz a D41)", () => {
    const withoutComments = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(withoutComments).not.toMatch(/CREATE UNIQUE INDEX "corretor_studio_leads_teamId_(email|cnpj)_key"/);
  });
});

describe("ordem das migrations do webhook v2", () => {
  it("as três ficam depois das migrations da rodada de webhooks e em ordem de dependência", () => {
    const files = readdirSync(__dirname).filter((file) => file.endsWith(".sql")).sort();
    const idx = (name: string) => files.indexOf(name);
    expect(idx(ENUM_MIGRATION)).toBeGreaterThan(idx("20261026130200_add-team-webhook-signing-secret.sql"));
    expect(idx(TABLES_MIGRATION)).toBeGreaterThan(idx(ENUM_MIGRATION));
    expect(idx(INDEX_MIGRATION)).toBeGreaterThan(idx(TABLES_MIGRATION));
  });
});

describe("migration do log de uso da API Studio (SPEC 14, A-E4)", () => {
  const sql = read("20261027134327_team-api-request-logs.sql");
  const table = "corretor_studio_team_api_request_logs";

  it("RLS ligado, sem acesso anon/authenticated e política só service_role", () => {
    expect(sql).toContain(`ALTER TABLE "public"."${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sql).toContain(`REVOKE ALL ON TABLE "public"."${table}" FROM PUBLIC, anon, authenticated;`);
    expect(sql).toContain(`GRANT ALL ON TABLE "public"."${table}" TO service_role;`);
    expect(sql).toMatch(new RegExp(`CREATE POLICY "${table}_service_role_only"[\\s\\S]*?FOR ALL TO service_role`));
  });

  it("nunca guarda token, hash de token nem IP", () => {
    expect(sql).not.toMatch(/"(token|tokenHash|ip|ipAddress)"/i);
  });

  it("indexa a listagem por time e a retenção por data", () => {
    expect(sql).toContain('("teamId", "resourceSlug", "createdAt" DESC)');
    expect(sql).toContain('("createdAt");');
  });
});

