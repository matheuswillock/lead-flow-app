import { describe, expect, it } from "bun:test";

import { COMPOSE_COMMAND } from "./local-stack";

describe("local-stack", () => {
  it("orquestra o stack local por podman compose, não pelo shim docker", () => {
    expect(COMPOSE_COMMAND).toBe("podman");
  });
});
