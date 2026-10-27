import { describe, expect, it } from "bun:test";
import { pickNextAssignee } from "./roundRobin";

const LIST = ["sdr-a", "sdr-b", "sdr-c"];

describe("pickNextAssignee (DA11)", () => {
  it("sem ponteiro anterior, começa pelo primeiro SDR válido", () => {
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: null, validIds: new Set(LIST) })).toBe("sdr-a");
  });

  it("vai para o seguinte ao último atendido e volta ao primeiro depois do último", () => {
    const valid = new Set(LIST);
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-a", validIds: valid })).toBe("sdr-b");
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-b", validIds: valid })).toBe("sdr-c");
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-c", validIds: valid })).toBe("sdr-a");
  });

  it("com um SDR só, todos os leads vão para ele", () => {
    expect(pickNextAssignee({ ordered: ["sdr-a"], lastAssignedId: "sdr-a", validIds: new Set(["sdr-a"]) })).toBe("sdr-a");
  });

  it("pula o SDR que saiu do time ou ficou inativo, sem quebrar o rodízio (T-11.14c)", () => {
    const valid = new Set(["sdr-a", "sdr-c"]);
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-a", validIds: valid })).toBe("sdr-c");
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-c", validIds: valid })).toBe("sdr-a");
  });

  it("se o último atendido saiu da lista, retoma pelo primeiro válido", () => {
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-removido", validIds: new Set(LIST) })).toBe("sdr-a");
  });

  it("lista sem nenhum SDR válido devolve null (lead sem responsável)", () => {
    expect(pickNextAssignee({ ordered: LIST, lastAssignedId: "sdr-a", validIds: new Set() })).toBeNull();
    expect(pickNextAssignee({ ordered: [], lastAssignedId: null, validIds: new Set(LIST) })).toBeNull();
  });

  it("dez eventos para três SDRs distribuem 4, 3 e 3 na ordem da lista", () => {
    const valid = new Set(LIST);
    const counts: Record<string, number> = { "sdr-a": 0, "sdr-b": 0, "sdr-c": 0 };
    let last: string | null = null;
    for (let index = 0; index < 10; index += 1) {
      const next = pickNextAssignee({ ordered: LIST, lastAssignedId: last, validIds: valid });
      counts[next as string] += 1;
      last = next;
    }
    expect(counts).toEqual({ "sdr-a": 4, "sdr-b": 3, "sdr-c": 3 });
  });
});
