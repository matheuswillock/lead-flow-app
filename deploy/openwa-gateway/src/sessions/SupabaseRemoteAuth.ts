import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import archiver from "archiver";
import unzipper from "unzipper";
import { config } from "../config.js";
import type { RemoteAuthStore } from "../types.js";

const BUCKET = "openwa-sessions";

export type CompressFn = (dirPath: string) => Promise<Buffer>;
export type UnzipFn = (buffer: Buffer, destPath: string) => Promise<void>;

async function defaultCompress(dirPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

async function defaultUnzip(buffer: Buffer, destPath: string): Promise<void> {
  fs.mkdirSync(destPath, { recursive: true });
  const { Readable } = await import("node:stream");
  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer)
      .pipe(unzipper.Extract({ path: destPath }))
      .on("close", resolve)
      .on("error", reject);
  });
}

export class SupabaseRemoteAuthStore implements RemoteAuthStore {
  private readonly supabase: SupabaseClient;
  private readonly compressFn: CompressFn;
  private readonly unzipFn: UnzipFn;

  constructor(opts?: {
    supabase?: SupabaseClient;
    compress?: CompressFn;
    unzip?: UnzipFn;
  }) {
    this.supabase =
      opts?.supabase ??
      createClient(config.supabaseUrl, config.supabaseKey);
    this.compressFn = opts?.compress ?? defaultCompress;
    this.unzipFn = opts?.unzip ?? defaultUnzip;
  }

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const { data } = await this.supabase.storage
      .from(BUCKET)
      .list("", { search: `${session}.zip` });
    return (data ?? []).length > 0;
  }

  async save({ session }: { session: string }): Promise<void> {
    const sessionDir = path.join(".wwebjs_auth", session);
    const zipBuffer = await this.compressFn(sessionDir);
    await this.supabase.storage
      .from(BUCKET)
      .upload(`${session}.zip`, zipBuffer, {
        upsert: true,
        contentType: "application/zip",
      });
  }

  async extract({ session, path: destPath }: { session: string; path: string }): Promise<void> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .download(`${session}.zip`);
    if (error || !data) return;
    const buffer = Buffer.from(await data.arrayBuffer());
    await this.unzipFn(buffer, destPath);
  }

  async delete({ session }: { session: string }): Promise<void> {
    await this.supabase.storage.from(BUCKET).remove([`${session}.zip`]);
  }
}
