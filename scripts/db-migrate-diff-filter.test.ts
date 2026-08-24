import { describe, expect, test } from "bun:test";

import {
  classifyStatement,
  filterUnmanagedStatements,
  splitSqlStatements,
  unwrapDiffOutput,
} from "./db-migrate-diff-filter";

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

  test("classifica drop default como column-default", () => {
    expect(
      classifyStatement(`alter table "public"."t" alter column "id" drop default;`),
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
      classifyStatement(`alter table "public"."t" alter column "id" set default gen_random_uuid();`),
    ).toBeNull();
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

    const result = filterUnmanagedStatements(sql);

    expect(result.removed).toEqual({ acl: 1, "column-default": 1, "rls-policy": 1 });
    expect(result.removedTotal).toBe(3);
    expect(result.sql).toContain("add column");
    expect(result.sql).not.toContain("grant");
    expect(result.sql).not.toContain("drop default");
    expect(result.sql).not.toContain("row level security");
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
