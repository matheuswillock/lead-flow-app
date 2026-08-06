import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.js";
import type { SessionRegistry } from "../types.js";

const BUCKET = "openwa-sessions";
const REGISTRY_PATH = "_session_registry.json";

type RegistryFile = Record<string, string>;

export class SupabaseSessionRegistry implements SessionRegistry {
  private readonly supabase: SupabaseClient;

  constructor(opts?: { supabase?: SupabaseClient }) {
    this.supabase = opts?.supabase ?? createClient(config.supabaseUrl, config.supabaseKey);
  }

  async upsert(instanceName: string, webhookUrl: string): Promise<void> {
    const registry = await this.readRegistry();
    registry[instanceName] = webhookUrl;
    await this.writeRegistry(registry);
  }

  async remove(instanceName: string): Promise<void> {
    const registry = await this.readRegistry();
    if (!(instanceName in registry)) return;
    delete registry[instanceName];
    await this.writeRegistry(registry);
  }

  async list(): Promise<Array<{ instanceName: string; webhookUrl: string }>> {
    const registry = await this.readRegistry();
    return Object.entries(registry).map(([instanceName, webhookUrl]) => ({
      instanceName,
      webhookUrl,
    }));
  }

  private async readRegistry(): Promise<RegistryFile> {
    const { data, error } = await this.supabase.storage.from(BUCKET).download(REGISTRY_PATH);
    if (error || !data) return {};
    try {
      const parsed: unknown = JSON.parse(await data.text());
      if (typeof parsed !== "object" || parsed === null) return {};
      const registry: RegistryFile = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") registry[key] = value;
      }
      return registry;
    } catch {
      return {};
    }
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    const body = JSON.stringify(registry);
    await this.supabase.storage.from(BUCKET).upload(REGISTRY_PATH, body, {
      upsert: true,
      contentType: "application/json",
    });
  }
}
