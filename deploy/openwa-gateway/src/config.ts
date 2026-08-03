import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3333),
  OPENWA_API_KEY: z.string().min(1),
  OPENWA_WEBHOOK_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url(),
  OPENWA_SUPABASE_KEY: z.string().min(1),
  CHROMIUM_PATH: z.string().default("/usr/bin/chromium"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("[config] Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  apiKey: parsed.data.OPENWA_API_KEY,
  webhookSecret: parsed.data.OPENWA_WEBHOOK_SECRET,
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseKey: parsed.data.OPENWA_SUPABASE_KEY,
  chromiumPath: parsed.data.CHROMIUM_PATH,
  nodeEnv: parsed.data.NODE_ENV,
};
