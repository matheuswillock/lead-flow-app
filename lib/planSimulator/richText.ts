/**
 * Formatador do texto das regras: transforma o texto corrido da operadora em
 * tabelas, listas e pares chave/valor. Porta fiel de parseRich/groupPara do protótipo.
 */

export type RichBlock =
  | { t: "table"; rows: string[][] }
  | { t: "kv"; rows: [string, string][] }
  | { t: "ul"; items: string[] }
  | { t: "h"; text: string }
  | { t: "p"; text: string };

const isPipe = (line: string) => /^\s*\|/.test(line);

export function parseRich(raw: string): RichBlock[] {
  const lines = String(raw || "").replace(/\r/g, "").split("\n");
  const out: RichBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(...groupPara(para));
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    if (!isPipe(lines[i]) && i + 1 < lines.length && isPipe(lines[i + 1])) {
      flush();
      const rows: string[][] = [];
      let row: string[] = [];
      let cell: string[] = [lines[i]];
      let ended = false;
      i++;
      for (; i < lines.length; i++) {
        const l = lines[i];
        if (isPipe(l)) {
          const rest = l.replace(/^\s*\|/, "");
          row.push(cell.join("\n").trim());
          cell = [];
          if (rest.trim() === "") {
            rows.push(row);
            row = [];
            if (!/ $/.test(l)) {
              ended = true;
              break;
            }
          } else {
            cell = [rest.replace(/^ /, "")];
          }
        } else {
          cell.push(l);
        }
      }
      if (!ended) {
        const c = cell.join("\n").trim();
        if (c) row.push(c);
        if (row.length) rows.push(row);
      }

      let clean = rows.filter((r) => r.some((c) => c));
      if (clean.length >= 4 && clean.every((r) => r.length === 1)) {
        // Tabela sem marcação de linha: tenta quebrar nas linhas numeradas (0, 1, 2…); senão vira lista.
        const cells = clean.map((r) => r[0]);
        const idx: number[] = [];
        let expect: number | null = null;
        cells.forEach((c, k) => {
          if (/^\d{1,2}$/.test(c.trim())) {
            const v = Number(c.trim());
            if (expect == null || v === expect) {
              idx.push(k);
              expect = v + 1;
            }
          }
        });
        if (idx.length >= 2) {
          clean = [cells.slice(0, idx[0])];
          idx.forEach((s, j) => clean.push(cells.slice(s, j + 1 < idx.length ? idx[j + 1] : cells.length)));
          clean = clean.filter((r) => r.length);
        } else {
          out.push({ t: "ul", items: cells });
          continue;
        }
      }
      if (clean.length) out.push({ t: "table", rows: clean });
    } else if (!isPipe(lines[i])) {
      para.push(lines[i]);
    }
  }
  flush();
  return out;
}

export function groupPara(input: string[]): RichBlock[] {
  const out: RichBlock[] = [];
  const lines = input.map((l) => l.trim()).filter(Boolean);
  const kvRe = /^([^:]{2,52}):\s+(.{1,700})$/;
  const isKV = (l: string) => kvRe.test(l) && !/\.\s/.test(l.split(":")[0]);
  const bullet = /^[-•*–]\s+/;
  let i = 0;

  while (i < lines.length) {
    const l = lines[i];
    if (isKV(l)) {
      let j = i;
      const kv: [string, string][] = [];
      while (j < lines.length && isKV(lines[j])) {
        const m = lines[j].match(kvRe)!;
        kv.push([m[1], m[2]]);
        j++;
      }
      if (kv.length >= 2) {
        out.push({ t: "kv", rows: kv });
        i = j;
        continue;
      }
    }
    if (bullet.test(l)) {
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i])) {
        items.push(lines[i].replace(bullet, ""));
        i++;
      }
      out.push({ t: "ul", items });
      continue;
    }
    if (/:$/.test(l) && l.length < 80) {
      out.push({ t: "h", text: l.replace(/:$/, "") });
      i++;
      continue;
    }
    if (/;$/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && (/;$/.test(lines[i]) || (items.length && /;$/.test(lines[i - 1])))) {
        items.push(lines[i]);
        i++;
        if (!/;$/.test(lines[i - 1])) break;
      }
      if (items.length >= 2) {
        out.push({ t: "ul", items });
        continue;
      }
      out.push({ t: "p", text: items[0] });
      continue;
    }
    out.push({ t: "p", text: l });
    i++;
  }
  return out;
}

/** Normaliza para comparação: sem acento, sem apóstrofo, minúsculo. */
export function normText(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .toLowerCase();
}

/** Marca a coluna da tabela que corresponde ao plano (destaque). */
export function matchesPlan(cell: string, plan: string): boolean {
  const c = normText(cell).replace(/\s+/g, " ").trim();
  const p = normText(plan).replace(/\s+/g, " ").trim();
  if (c.length < 3) return false;
  return c === p || (p.startsWith(c + " ") && c.length >= 4);
}

/** Índice da coluna que corresponde ao plano, ou -1. Usado pela tabela de regras. */
export function highlightColumn(header: string[], plan: string): number {
  let hl = -1;
  header.forEach((h, k) => {
    if (k > 0 && hl < 0 && matchesPlan(h, plan)) hl = k;
  });
  return hl;
}
