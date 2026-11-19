import { planOperatorLogoPath } from "./planCatalogTransform";

export type PlanLogoFile = { path: string; content: Buffer };

/**
 * Converte os logos embutidos no protótipo (data URI base64) em arquivos
 * estáticos para `public/`. Só aceita SVG: qualquer outro tipo aborta.
 */
export function planLogoFiles(logodb: Record<string, string>): { files: PlanLogoFile[]; errors: string[] } {
  const files: PlanLogoFile[] = [];
  const errors: string[] = [];

  for (const [name, uri] of Object.entries(logodb)) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(uri);
    if (!match) {
      errors.push(`logo de ${name} não é data URI base64`);
      continue;
    }
    const [, mime, data] = match;
    if (mime !== "image/svg+xml") {
      errors.push(`logo de ${name} tem tipo ${mime}; esperado image/svg+xml`);
      continue;
    }
    files.push({ path: planOperatorLogoPath(name), content: Buffer.from(data, "base64") });
  }

  return { files, errors };
}

/** Extrai o mapa nome -> data URI do <script id="logodb"> do HTML do protótipo. */
export function extractLogodbFromPrototype(html: string): Record<string, string> {
  const match = /<script[^>]*id="logodb"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('HTML do protótipo sem <script id="logodb">.')
  return JSON.parse(match[1]) as Record<string, string>
}
