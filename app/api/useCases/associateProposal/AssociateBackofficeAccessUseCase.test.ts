import { describe, expect, it } from "bun:test";
import { AssociateBackofficeAccessUseCase } from "./AssociateBackofficeAccessUseCase";

describe("AssociateBackofficeAccessUseCase.resolve authorization matrix", () => {
  const useCase = new AssociateBackofficeAccessUseCase();

  it("exposes resolve method", () => {
    expect(typeof useCase.resolve).toBe("function");
  });
});
