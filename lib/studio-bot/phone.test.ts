import { describe, expect, test } from "bun:test";
import { looksLikeEmail, phoneDigitsEqual } from "./phone";

describe("phoneDigitsEqual", () => {
  test("aceita mesmo número com formatações diferentes", () => {
    expect(phoneDigitsEqual("+55 11 98885-9573", "11988859573")).toBe(true);
    expect(phoneDigitsEqual("5511924651308", "(11) 92465-1308")).toBe(true);
  });

  test("rejeita números diferentes", () => {
    expect(phoneDigitsEqual("11988859573", "11924651308")).toBe(false);
  });

  test("rejeita valores curtos ou vazios", () => {
    expect(phoneDigitsEqual("", "11988859573")).toBe(false);
    expect(phoneDigitsEqual("123", "123")).toBe(false);
  });
});

describe("looksLikeEmail", () => {
  test("aceita e-mail válido", () => {
    expect(looksLikeEmail("  Nome@Empresa.com  ")).toBe("nome@empresa.com");
  });

  test("rejeita texto que não é e-mail", () => {
    expect(looksLikeEmail("menu")).toBeNull();
    expect(looksLikeEmail("nome@")).toBeNull();
    expect(looksLikeEmail("")).toBeNull();
  });
});
