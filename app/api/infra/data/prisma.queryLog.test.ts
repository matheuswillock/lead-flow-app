import { describe, expect, it } from "bun:test";

import { resolveQueryLogOptions } from "./prisma";

describe("resolveQueryLogOptions", () => {
  it("fica desligado por padrao, sem a flag", () => {
    expect(resolveQueryLogOptions({ NODE_ENV: "development" })).toEqual({});
  });

  it("ignora qualquer valor que nao seja exatamente '1'", () => {
    // Evita que "true", "0" ou "" liguem o log por acidente.
    for (const value of ["true", "0", "", "yes", "2"]) {
      expect(
        resolveQueryLogOptions({ PRISMA_LOG_QUERIES: value, NODE_ENV: "development" })
      ).toEqual({});
    }
  });

  it("liga o log fora de producao quando a flag e '1'", () => {
    expect(
      resolveQueryLogOptions({ PRISMA_LOG_QUERIES: "1", NODE_ENV: "development" })
    ).toEqual({ log: ["query"] });
  });

  it("liga em test, que tambem nao e ambiente de deploy", () => {
    expect(resolveQueryLogOptions({ PRISMA_LOG_QUERIES: "1", NODE_ENV: "test" })).toEqual({
      log: ["query"],
    });
  });

  it("NAO liga em producao, mesmo com a flag em '1'", () => {
    // Propriedade de seguranca: o log de query do Prisma imprime os parametros,
    // que incluem e-mail, telefone e nome de lead. Ligar num deploy vazaria dado
    // de cliente para o log do provedor.
    expect(
      resolveQueryLogOptions({ PRISMA_LOG_QUERIES: "1", NODE_ENV: "production" })
    ).toEqual({});
  });
});
