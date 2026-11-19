"use client";

import { FAIXAS } from "@/components/plan-simulator/format";
import { IconMinus, IconPlus } from "@/components/plan-simulator/Icons";

type Props = {
  lives: number[];
  onChange: (index: number, value: number) => void;
};

/** Contador de vidas por faixa etária (markup do protótipo: .ages, .age, .rb). */
export function LivesBlock({ lives, onChange }: Props) {
  const total = lives.reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="ages">
        {FAIXAS.map((label, i) => {
          const v = lives[i] ?? 0;
          return (
            <div key={label} className={`age${v > 0 ? " on" : ""}`}>
              <div className="top"><span className="lb">{label}</span><span className="un">ANOS</span></div>
              <div className="ctl">
                <button type="button" className="rb" aria-label={`Remover uma vida de ${label} anos`} disabled={v <= 0} onClick={() => onChange(i, v - 1)}>
                  <IconMinus />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Vidas de ${label} anos`}
                  value={v}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                    onChange(i, digits === "" ? 0 : Number(digits));
                  }}
                />
                <button type="button" className="rb plus" aria-label={`Adicionar uma vida de ${label} anos`} onClick={() => onChange(i, v + 1)}>
                  <IconPlus />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="agehint">
        <span>Os preços consideram só as faixas preenchidas.</span>
        {total > 0 ? (
          <button type="button" className="linkbtn" onClick={() => FAIXAS.forEach((_, i) => onChange(i, 0))}>Zerar vidas</button>
        ) : null}
      </div>
    </div>
  );
}
