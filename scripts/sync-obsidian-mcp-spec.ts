import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const FILES = [
  "docs/obsidian/specs/corretor-studio-mcp.md",
  "docs/obsidian/specs/corretor-studio-mcp/oauth.md",
  "docs/obsidian/specs/corretor-studio-mcp/tools.md",
  "docs/obsidian/specs/corretor-studio-mcp/security.md",
  "docs/obsidian/specs/corretor-studio-mcp/implementation-phases.md",
] as const;

for (const rel of FILES) {
  const content = readFileSync(join(ROOT, rel), "utf8");
  const vaultPath = rel.replace(/^docs\/obsidian\//, "");
  const code = `(async()=>{const p=${JSON.stringify(vaultPath)};const c=${JSON.stringify(content)};const f=app.vault.getAbstractFileByPath(p);if(f){await app.vault.modify(f,c);return "modified:"+p;}const dir=p.split("/").slice(0,-1).join("/");if(dir){await app.vault.createFolder(dir).catch(()=>{});}await app.vault.create(p,c);return "created:"+p;})()`;

  const out = execSync(`obsidian eval code=${JSON.stringify(code)}`, {
    encoding: "utf8",
  });
  console.info(`[sync-obsidian-mcp] ${out.trim()}`);
}
