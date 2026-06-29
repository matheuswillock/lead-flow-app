import { describe, expect, it } from "bun:test";
import { APP_NOTIFICATION_TITLE } from "./constants";
import { parsePushPayload } from "./parse-push-payload";

describe("parsePushPayload", () => {
  it("returns defaults when data is null", () => {
    expect(parsePushPayload(null)).toEqual({
      title: APP_NOTIFICATION_TITLE,
      body: "",
      url: "/",
    });
  });

  it("parses json payload", () => {
    const payload = parsePushPayload({
      json: () => ({
        title: "Teste",
        body: "Mensagem",
        url: "/crm",
      }),
      text: () => "fallback",
    });

    expect(payload).toEqual({
      title: "Teste",
      body: "Mensagem",
      url: "/crm",
    });
  });

  it("falls back to text when json is invalid", () => {
    const payload = parsePushPayload({
      json: () => {
        throw new Error("invalid");
      },
      text: () => "texto bruto",
    });

    expect(payload.body).toBe("texto bruto");
    expect(payload.title).toBe(APP_NOTIFICATION_TITLE);
  });
});
