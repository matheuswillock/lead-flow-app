import { describe, it, expect, mock } from "bun:test";
import { SupabaseSessionRegistry } from "./SessionRegistry.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeSupabaseMock(initialRegistry: Record<string, string> = {}) {
  let registry = { ...initialRegistry };

  const fromMock = {
    download: mock(async (path: string) => {
      if (path !== "_session_registry.json") {
        return { data: null, error: { message: "not found" } };
      }
      return {
        data: new Blob([JSON.stringify(registry)]),
        error: null,
      };
    }),
    upload: mock(async (_path: string, body: string) => {
      registry = JSON.parse(body) as Record<string, string>;
      return { error: null };
    }),
  };

  const supabase = {
    storage: { from: () => fromMock },
  } as unknown as SupabaseClient;

  return { supabase, getRegistry: () => registry };
}

describe("SupabaseSessionRegistry", () => {
  it("upsert persiste webhook por instância", async () => {
    const { supabase, getRegistry } = makeSupabaseMock();
    const registry = new SupabaseSessionRegistry({ supabase });

    await registry.upsert("inst-1", "https://hook.example.com/a");
    await registry.upsert("inst-2", "https://hook.example.com/b");

    expect(getRegistry()).toEqual({
      "inst-1": "https://hook.example.com/a",
      "inst-2": "https://hook.example.com/b",
    });
  });

  it("list retorna entradas persistidas", async () => {
    const { supabase } = makeSupabaseMock({
      "inst-1": "https://hook.example.com/a",
    });
    const registry = new SupabaseSessionRegistry({ supabase });

    const entries = await registry.list();
    expect(entries).toEqual([
      { instanceName: "inst-1", webhookUrl: "https://hook.example.com/a" },
    ]);
  });

  it("remove apaga instância do registry", async () => {
    const { supabase, getRegistry } = makeSupabaseMock({
      "inst-1": "https://hook.example.com/a",
    });
    const registry = new SupabaseSessionRegistry({ supabase });

    await registry.remove("inst-1");

    expect(getRegistry()).toEqual({});
  });
});
