import { describe, expect, test } from "bun:test";
import { POLLING_MAX_ATTEMPTS, getPollingDelayMs, hasReachedPollingCap } from "./pollingSchedule";

describe("getPollingDelayMs", () => {
  test("tentativa 0 é imediata", () => {
    expect(getPollingDelayMs(0)).toBe(0);
  });

  test("tentativa 1 começa em 5s", () => {
    expect(getPollingDelayMs(1)).toBe(5000);
  });

  test("faz backoff linear de 1s por tentativa", () => {
    expect(getPollingDelayMs(2)).toBe(6000);
    expect(getPollingDelayMs(3)).toBe(7000);
  });

  test("nunca ultrapassa o teto de 8s", () => {
    expect(getPollingDelayMs(4)).toBe(8000);
    expect(getPollingDelayMs(10)).toBe(8000);
  });
});

describe("hasReachedPollingCap", () => {
  test("falso antes do teto de tentativas", () => {
    expect(hasReachedPollingCap(POLLING_MAX_ATTEMPTS - 1)).toBe(false);
  });

  test("verdadeiro ao atingir o teto — nunca spinner eterno (DA3)", () => {
    expect(hasReachedPollingCap(POLLING_MAX_ATTEMPTS)).toBe(true);
    expect(hasReachedPollingCap(POLLING_MAX_ATTEMPTS + 5)).toBe(true);
  });
});
