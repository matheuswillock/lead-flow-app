import { describe, expect, it } from "bun:test";
import { resolveUnlimitedLossNotice } from "./billingGraceUnlimitedLoss";

const user = (id: string) => ({ id, name: id, email: `${id}@example.com`, role: "operator" });

const base = {
  losesUnlimitedUsers: true,
  accountUsers: [user("ana"), user("bia")],
  billedUsers: [user("ana"), user("bia")],
  extraUserPrice: 20,
  extraUsersTotal: 120,
  months: 3,
};

describe("resolveUnlimitedLossNotice", () => {
  it("sem perda do ilimitado (anual ou conta que nunca teve), não há aviso", () => {
    expect(resolveUnlimitedLossNotice({ ...base, losesUnlimitedUsers: false })).toBeNull();
  });

  it("com usuários adicionais, informa quantos, o valor mensal e o total do prazo", () => {
    expect(resolveUnlimitedLossNotice(base)).toEqual({
      kind: "charged",
      userCount: 2,
      monthlyPrice: 20,
      periodTotal: 120,
      months: 3,
    });
  });

  it("acompanha as caixas: só os usuários mantidos entram na contagem e no total", () => {
    const notice = resolveUnlimitedLossNotice({ ...base, billedUsers: [user("ana")], extraUsersTotal: 60 });

    expect(notice).toMatchObject({ kind: "charged", userCount: 1, periodTotal: 60 });
  });

  it("todos desmarcados: ninguém é cobrado", () => {
    expect(resolveUnlimitedLossNotice({ ...base, billedUsers: [], extraUsersTotal: 0 })).toEqual({ kind: "all_removed" });
  });

  it("usuário com preço zerado: sair do anual não custa nada, então não há aviso", () => {
    expect(resolveUnlimitedLossNotice({ ...base, extraUserPrice: 0, extraUsersTotal: 0 })).toBeNull();
  });

  it("conta sem usuários adicionais: aviso sem valor", () => {
    expect(
      resolveUnlimitedLossNotice({ ...base, accountUsers: [], billedUsers: [], extraUsersTotal: 0 }),
    ).toEqual({ kind: "no_extra_users" });
  });
});
