import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  classifyStatement,
  filterUnmanagedStatements,
  readClientSideDefaults,
  splitSqlStatements,
  unwrapDiffOutput,
} from "./db-migrate-diff-filter";

/** Colunas com default resolvido no client, em nomes físicos. */
const CLIENT_DEFAULTS = new Set(["t.id", "t.updatedAt", "corretor_studio_leads.updatedAt"]);

describe("splitSqlStatements", () => {
  test("quebra statements simples", () => {
    const parts = splitSqlStatements("select 1; select 2;").map((s) => s.trim());
    expect(parts).toEqual(["select 1;", "select 2;"]);
  });

  test("não quebra dentro de dollar-quoting", () => {
    const sql = `create function f() returns void as $$ begin raise notice 'a;b'; end $$ language plpgsql; select 1;`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  test("não quebra dentro de literal com ponto e vírgula", () => {
    const sql = `insert into t (c) values ('a;b'); select 1;`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  test("não quebra dentro de identificador entre aspas duplas", () => {
    const sql = `alter table "public"."weird;name" drop constraint "x"; select 1;`;
    expect(splitSqlStatements(sql)).toHaveLength(2);
  });

  test("ignora ponto e vírgula dentro de comentário de linha", () => {
    const sql = "-- comentário; com ponto e vírgula\nselect 1;";
    expect(splitSqlStatements(sql)).toHaveLength(1);
  });

  test("preserva statement final sem ponto e vírgula", () => {
    expect(splitSqlStatements("select 1").map((s) => s.trim())).toEqual(["select 1"]);
  });
});

describe("classifyStatement", () => {
  test("classifica GRANT e REVOKE como acl", () => {
    expect(classifyStatement(`grant select on table "public"."t" to "anon";`)).toBe("acl");
    expect(classifyStatement(`revoke delete on table "public"."t" from "service_role";`)).toBe("acl");
  });

  test("classifica drop default como column-default quando o default é do client", () => {
    expect(
      classifyStatement(`alter table "public"."t" alter column "id" drop default;`, CLIENT_DEFAULTS),
    ).toBe("column-default");
    expect(
      classifyStatement(
        `alter table "public"."t" alter column "updatedAt" drop default;`,
        CLIENT_DEFAULTS,
      ),
    ).toBe("column-default");
  });

  test("NÃO filtra drop default de coluna sem default client-side", () => {
    // Remoção intencional de um default do banco precisa chegar na migration.
    expect(
      classifyStatement(
        `alter table "public"."t" alter column "filters" drop default;`,
        CLIENT_DEFAULTS,
      ),
    ).toBeNull();
    expect(
      classifyStatement(
        `alter table "public"."outra" alter column "id" drop default;`,
        CLIENT_DEFAULTS,
      ),
    ).toBeNull();
  });

  test("sem allowlist, nenhum drop default é filtrado", () => {
    expect(classifyStatement(`alter table "public"."t" alter column "id" drop default;`)).toBeNull();
  });

  // Regressão: `splitSqlStatements` devolve o statement com o `\n\n` que o
  // separava do anterior. Sem `trim()` antes do match com caixa preservada, a
  // coluna vinha em minúsculas do texto normalizado e nunca batia na allowlist.
  test("casa a coluna mesmo com whitespace à esquerda do statement", () => {
    expect(
      classifyStatement(
        `\n\nalter table "public"."t" alter column "updatedAt" drop default;`,
        CLIENT_DEFAULTS,
      ),
    ).toBe("column-default");
  });

  test("comentário antes do statement não atrapalha", () => {
    expect(
      classifyStatement(
        `-- ajuste\nalter table "public"."t" alter column "updatedAt" drop default;`,
        CLIENT_DEFAULTS,
      ),
    ).toBe("column-default");
  });

  test("classifica policy e row level security como rls-policy", () => {
    expect(classifyStatement(`create policy "p" on "public"."t" for select using (true);`)).toBe(
      "rls-policy",
    );
    expect(classifyStatement(`alter table "public"."t" enable row level security;`)).toBe(
      "rls-policy",
    );
    expect(classifyStatement(`alter table "public"."t" disable row level security;`)).toBe(
      "rls-policy",
    );
  });

  test("não classifica mudanças de schema que devem sobreviver", () => {
    const survivors = [
      `create table "public"."t" ("id" uuid not null);`,
      `drop table "public"."t";`,
      `alter table "public"."t" add column "c" text;`,
      `alter table "public"."t" drop constraint "t_fkey";`,
      `alter table "public"."t" add constraint "t_fkey" FOREIGN KEY ("a") REFERENCES public.u(id);`,
      `alter table "public"."t" alter column "c" set data type text;`,
      `alter table "public"."t" alter column "c" set not null;`,
      `create index "t_c_idx" on public.t using btree ("c");`,
      `drop index if exists "public"."t_c_idx";`,
      `create type "public"."e" as enum ('a');`,
    ];

    for (const statement of survivors) {
      expect(classifyStatement(statement)).toBeNull();
    }
  });

  test("set default (e não drop default) sobrevive", () => {
    expect(
      classifyStatement(
        `alter table "public"."t" alter column "id" set default gen_random_uuid();`,
        CLIENT_DEFAULTS,
      ),
    ).toBeNull();
  });
});

describe("readClientSideDefaults", () => {
  const schema = `
model Lead {
  id        String   @id @default(uuid()) @db.Uuid
  updatedAt DateTime @updatedAt @db.Timestamptz(6)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  filters   Json
  legacyRef String   @map("legacy_ref")
  sortOrder Int      @default(0)

  @@map("corretor_studio_leads")
}

model SemMap {
  id    String @id @default(cuid())
  score Int    @default(0)
}

model ComDefaultNoBanco {
  id        String   @id @default(uuid())
  // now() vira DEFAULT CURRENT_TIMESTAMP: o banco fica com default físico,
  // mesmo o campo tendo @updatedAt.
  updatedAt DateTime @default(now()) @updatedAt
  expiraEm  DateTime @default(dbgenerated("(now() + '30 days'::interval)"))
  seq       Int      @default(autoincrement())

  @@map("com_default_no_banco")
}
`;

  const defaults = readClientSideDefaults(schema);

  test("resolve o nome físico da tabela via @@map", () => {
    expect(defaults.has("corretor_studio_leads.id")).toBe(true);
    expect(defaults.has("Lead.id")).toBe(false);
  });

  test("inclui @updatedAt e @default(uuid()/cuid())", () => {
    expect(defaults.has("corretor_studio_leads.updatedAt")).toBe(true);
    expect(defaults.has("SemMap.id")).toBe(true);
  });

  test("exclui default resolvido no banco", () => {
    // now() e literais viram DEFAULT físico — remover é mudança de verdade.
    expect(defaults.has("corretor_studio_leads.createdAt")).toBe(false);
    expect(defaults.has("corretor_studio_leads.sortOrder")).toBe(false);
    expect(defaults.has("SemMap.score")).toBe(false);
  });

  test("exclui coluna sem default nenhum", () => {
    expect(defaults.has("corretor_studio_leads.filters")).toBe(false);
    expect(defaults.has("corretor_studio_leads.legacy_ref")).toBe(false);
  });

  test("@updatedAt combinado com @default(now()) NÃO é client-side", () => {
    // O banco fica com DEFAULT CURRENT_TIMESTAMP; remover o @default(now())
    // é um DROP DEFAULT intencional e não pode ser filtrado.
    expect(defaults.has("com_default_no_banco.updatedAt")).toBe(false);
  });

  test("dbgenerated e autoincrement não são client-side", () => {
    expect(defaults.has("com_default_no_banco.expiraEm")).toBe(false);
    expect(defaults.has("com_default_no_banco.seq")).toBe(false);
  });

  test("@default(uuid()) continua client-side no mesmo model", () => {
    expect(defaults.has("com_default_no_banco.id")).toBe(true);
  });

  test("o schema real do projeto marca id e updatedAt de corretor_studio_leads", () => {
    const real = readClientSideDefaults(readFileSync("prisma/schema.prisma", "utf8"));
    expect(real.has("corretor_studio_leads.id")).toBe(true);
    expect(real.has("corretor_studio_leads.updatedAt")).toBe(true);
    // As 4 colunas com default físico declarado não podem entrar na allowlist.
    expect(real.has("backoffice_lead_extractions.filters")).toBe(false);
    expect(real.has("whatsapp_messages.rawPayload")).toBe(false);
    expect(real.has("corretor_studio_team_radar_pixel_configs.allowedOrigins")).toBe(false);
    expect(real.has("corretor_studio_lead_document_requests.expiresAt")).toBe(false);
  });

  test("os 5 campos reais com @default(now()) @updatedAt ficam fora da allowlist", () => {
    const real = readClientSideDefaults(readFileSync("prisma/schema.prisma", "utf8"));

    for (const column of [
      "backoffice_product_payment_rules.updatedAt",
      "corretor_studio_profile_subscriptions.updatedAt",
      "corretor_studio_profile_subscription_capacities.updatedAt",
      "profile_user_types.updatedAt",
      "profile_user_type_assignments.updatedAt",
    ]) {
      expect(real.has(column)).toBe(false);
    }
  });
});

describe("unwrapDiffOutput", () => {
  test("desembrulha o envelope JSON do CLI", () => {
    const raw = JSON.stringify({ diff: "select 1;", file: null, schemas: ["public"] });
    expect(unwrapDiffOutput(raw)).toBe("select 1;");
  });

  test("mantém SQL puro intacto", () => {
    expect(unwrapDiffOutput("select 1;")).toBe("select 1;");
  });

  test("mantém intacto quando o JSON é inválido", () => {
    expect(unwrapDiffOutput('{"diff": broken')).toBe('{"diff": broken');
  });
});

describe("filterUnmanagedStatements", () => {
  test("remove ruído e preserva mudança de schema", () => {
    const sql = [
      `grant select on table "public"."t" to "anon";`,
      `alter table "public"."t" alter column "id" drop default;`,
      `alter table "public"."t" add column "c" text;`,
      `alter table "public"."t" enable row level security;`,
    ].join("\n\n");

    const result = filterUnmanagedStatements(sql, CLIENT_DEFAULTS);

    expect(result.removed).toEqual({ acl: 1, "column-default": 1, "rls-policy": 1 });
    expect(result.removedTotal).toBe(3);
    expect(result.sql).toContain("add column");
    expect(result.sql).not.toContain("grant");
    expect(result.sql).not.toContain("drop default");
    expect(result.sql).not.toContain("row level security");
  });

  test("preserva o drop default intencional junto com o ruído", () => {
    const sql = [
      `grant select on table "public"."t" to "anon";`,
      `alter table "public"."t" alter column "id" drop default;`,
      `alter table "public"."t" alter column "filters" drop default;`,
    ].join("\n\n");

    const result = filterUnmanagedStatements(sql, CLIENT_DEFAULTS);

    expect(result.removed).toEqual({ acl: 1, "column-default": 1, "rls-policy": 0 });
    expect(result.sql).toContain(`alter column "filters" drop default`);
    expect(result.sql).not.toContain(`alter column "id" drop default`);
  });

  test("retorna sql vazio quando só havia ruído", () => {
    const sql = `grant select on table "public"."t" to "anon";\n\nrevoke delete on table "public"."t" from "anon";`;
    expect(filterUnmanagedStatements(sql).sql).toBe("");
  });

  test("aceita o envelope JSON direto", () => {
    const raw = JSON.stringify({
      diff: `grant select on table "public"."t" to "anon";\n\ndrop table "public"."t";`,
    });

    const result = filterUnmanagedStatements(raw);

    expect(result.removed.acl).toBe(1);
    expect(result.sql.trim()).toBe(`drop table "public"."t";`);
  });

  test("não remove nada de um diff limpo", () => {
    const sql = `create index "t_c_idx" on public.t using btree ("c");`;
    const result = filterUnmanagedStatements(sql);

    expect(result.removedTotal).toBe(0);
    expect(result.sql.trim()).toBe(sql);
  });
});
