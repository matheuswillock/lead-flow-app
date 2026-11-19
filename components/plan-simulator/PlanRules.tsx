import { highlightColumn, parseRich, type RichBlock } from "@/lib/planSimulator/richText";

const YES = /^(✓|✔|sim)$/i;
const NO = /^(x|não|nao)$/i;

function Cell({ value, hl }: { value: string; hl: boolean }) {
  const v = value.trim();
  const cls = hl ? "hl" : undefined;
  if (YES.test(v)) return <td className={`yes${hl ? " hl" : ""}`}>✓ Sim</td>;
  if (NO.test(v)) return <td className={`no${hl ? " hl" : ""}`}>Não</td>;
  if (v === "-") return <td className={`no${hl ? " hl" : ""}`}>—</td>;
  return <td className={cls}>{v}</td>;
}

function RichTable({ rows, plan }: { rows: string[][]; plan: string }) {
  const maxLen = Math.max(...rows.map((r) => r.length));
  let caption = "";
  let i = 0;
  if (rows[0].length === 1 && maxLen > 1) {
    caption = rows[0][0];
    i = 1;
  }
  const header = rows[i] ?? [];
  const body = rows.slice(i + 1);
  const hl = highlightColumn(header, plan);
  return (
    <div className="box scrollx">
      <table className="dt">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {header.map((h, k) => (<th key={k} className={k === hl ? "hl" : undefined}>{h}</th>))}
            {Array.from({ length: Math.max(0, maxLen - header.length) }, (_, k) => <th key={`pad-${k}`} />)}
          </tr>
        </thead>
        <tbody>
          {body.map((r, k) =>
            r.length === 1 && maxLen > 1 ? (
              <tr key={k} className="sub"><td colSpan={maxLen}>{r[0]}</td></tr>
            ) : (
              <tr key={k}>
                {r.map((c, j) => (<Cell key={j} value={c} hl={r.length === header.length && j === hl} />))}
                {Array.from({ length: Math.max(0, maxLen - r.length) }, (_, j) => <td key={`pad-${j}`} />)}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, plan }: { block: RichBlock; plan: string }) {
  switch (block.t) {
    case "table":
      return <RichTable rows={block.rows} plan={plan} />;
    case "kv":
      return (
        <div className="box">
          <table className="kv">
            <tbody>
              {block.rows.map(([k, v], i) => (<tr key={i}><th>{k}</th><td>{v}</td></tr>))}
            </tbody>
          </table>
        </div>
      );
    case "ul":
      return <ul>{block.items.map((x, i) => (<li key={i}>{x}</li>))}</ul>;
    case "h":
      return <h4>{block.text}</h4>;
    default:
      return <p>{block.text}</p>;
  }
}

/** Texto de uma regra, formatado em tabelas, listas e pares chave/valor. */
export function PlanRules({ text, plan }: { text: string; plan: string }) {
  const blocks = parseRich(text);
  if (!blocks.length) return null;
  return <div className="rich">{blocks.map((b, i) => (<Block key={i} block={b} plan={plan} />))}</div>;
}
