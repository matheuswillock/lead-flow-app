import { describe, it, expect, mock } from "bun:test";
import { SupabaseRemoteAuthStore } from "./SupabaseRemoteAuth.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeSupabaseMock(overrides?: {
  listData?: Array<{ name: string }>;
  listError?: null;
  uploadError?: null;
  downloadData?: Blob | null;
  downloadError?: { message: string } | null;
  removeError?: null;
}) {
  const storage = {
    from: (_bucket: string) => ({
      list: mock(async () => ({
        data: overrides?.listData ?? [],
        error: overrides?.listError ?? null,
      })),
      upload: mock(async () => ({ error: overrides?.uploadError ?? null })),
      download: mock(async () => ({
        data: overrides?.downloadData ?? null,
        error: overrides?.downloadError ?? null,
      })),
      remove: mock(async () => ({ error: overrides?.removeError ?? null })),
    }),
  };
  return { storage } as unknown as SupabaseClient;
}

const stubCompress = async (_dir: string): Promise<Buffer> => Buffer.from("zip-content");
const stubUnzip = async (_buf: Buffer, _dest: string): Promise<void> => {};

describe("SupabaseRemoteAuthStore", () => {
  it("sessionExists retorna true quando zip existe", async () => {
    const supabase = makeSupabaseMock({ listData: [{ name: "sess.zip" }] });
    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: stubUnzip });

    const exists = await store.sessionExists({ session: "sess" });
    expect(exists).toBe(true);
  });

  it("sessionExists retorna false quando zip não existe", async () => {
    const supabase = makeSupabaseMock({ listData: [] });
    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: stubUnzip });

    const exists = await store.sessionExists({ session: "sess" });
    expect(exists).toBe(false);
  });

  it("save comprime e faz upload para o bucket", async () => {
    let uploadedBuffer: Buffer | null = null;
    const supabase = makeSupabaseMock();
    // Override upload mock to capture what was uploaded
    const fromMock = {
      list: mock(async () => ({ data: [], error: null })),
      upload: mock(async (_path: string, buffer: Buffer) => {
        uploadedBuffer = buffer;
        return { error: null };
      }),
      download: mock(async () => ({ data: null, error: null })),
      remove: mock(async () => ({ error: null })),
    };
    (supabase.storage as { from: unknown }).from = (_bucket: string) => fromMock;

    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: stubUnzip });
    await store.save({ session: "sess" });

    expect(fromMock.upload).toHaveBeenCalledTimes(1);
    expect(uploadedBuffer).toEqual(Buffer.from("zip-content"));
  });

  it("extract chama unzip com buffer do Supabase", async () => {
    let unzipCalled = false;
    let receivedBuffer: Buffer | null = null;
    const fakeBlob = new Blob([Buffer.from("fake-zip")]);
    const supabase = makeSupabaseMock({ downloadData: fakeBlob });
    const customUnzip = async (buf: Buffer, _dest: string) => {
      unzipCalled = true;
      receivedBuffer = buf;
    };

    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: customUnzip });
    await store.extract({ session: "sess", path: "/tmp/sess" });

    expect(unzipCalled).toBe(true);
    expect(receivedBuffer).not.toBeNull();
  });

  it("extract não lança quando download falha", async () => {
    const supabase = makeSupabaseMock({ downloadData: null, downloadError: { message: "not found" } });
    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: stubUnzip });

    await expect(store.extract({ session: "sess", path: "/tmp/sess" })).resolves.toBeUndefined();
  });

  it("delete remove o zip do bucket", async () => {
    const fromMock = {
      list: mock(async () => ({ data: [], error: null })),
      upload: mock(async () => ({ error: null })),
      download: mock(async () => ({ data: null, error: null })),
      remove: mock(async (_paths: string[]) => ({ error: null })),
    };
    const supabase = { storage: { from: () => fromMock } } as unknown as SupabaseClient;
    const store = new SupabaseRemoteAuthStore({ supabase, compress: stubCompress, unzip: stubUnzip });

    await store.delete({ session: "sess" });

    expect(fromMock.remove).toHaveBeenCalledWith(["sess.zip"]);
  });
});
