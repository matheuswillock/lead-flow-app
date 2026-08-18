import { describe, expect, it } from "bun:test";
import {
  formatUaBrands,
  serializeUnknownError,
} from "./client-error-report";

describe("serializeUnknownError", () => {
  it("reads name and message from Error", () => {
    const error = new DOMException(
      "Registration failed - push service not available",
      "AbortError",
    );

    expect(serializeUnknownError(error)).toEqual({
      name: "AbortError",
      message: "Registration failed - push service not available",
    });
  });

  it("wraps a string", () => {
    expect(serializeUnknownError("falhou")).toEqual({
      name: "Error",
      message: "falhou",
    });
  });
});

describe("formatUaBrands", () => {
  it("joins Chromium brands for Vercel logs", () => {
    expect(
      formatUaBrands([
        { brand: "Chromium", version: "128" },
        { brand: "Google Chrome", version: "128" },
      ]),
    ).toBe("Chromium/128, Google Chrome/128");
  });

  it("returns null when empty", () => {
    expect(formatUaBrands(undefined)).toBeNull();
    expect(formatUaBrands([])).toBeNull();
  });
});
