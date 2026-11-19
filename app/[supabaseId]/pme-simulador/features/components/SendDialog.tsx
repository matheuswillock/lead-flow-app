"use client";

import { useEffect, useState } from "react";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";
import { IconX } from "@/components/plan-simulator/Icons";

/** Envio ao cliente: gera o link (snapshot imutável), copia ou abre no WhatsApp (markup do protótipo: .dlg, .linkrow, .dacts). */
export function SendDialog() {
  const ctx = usePlanSimulatorContext();
  const [copied, setCopied] = useState(false);
  const count = ctx.draft.sel.length;

  useEffect(() => {
    if (ctx.sendOpen && !ctx.shareUrl && count > 0) void ctx.share();
    // Só ao abrir: o link é gerado com o estado do momento.
  }, [ctx.sendOpen]);

  const { sendOpen, setSendOpen } = ctx;
  useEffect(() => {
    if (!sendOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSendOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sendOpen, setSendOpen]);

  if (!ctx.sendOpen) return null;

  const message = ctx.shareUrl
    ? `Olá! Segue a cotação de planos de saúde (${ctx.nome}). Pelo link você vê as operadoras, os planos e os detalhes: ${ctx.shareUrl}`
    : "";

  async function copy() {
    if (!ctx.shareUrl) return;
    await navigator.clipboard?.writeText(ctx.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <>
      <div className="scrim" onClick={() => ctx.setSendOpen(false)} />
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dTitle">
        <div className="dh">
          <h3 id="dTitle">Enviar ao cliente</h3>
          <button type="button" className="x" aria-label="Fechar" onClick={() => ctx.setSendOpen(false)}><IconX /></button>
        </div>
        {count === 0 ? (
          <>
            <p className="muted">O cliente só vê os planos que você incluir. Abra uma operadora, escolha a tabela e clique em <b style={{ color: "var(--fg)" }}>Incluir</b> nos planos que quer mandar.</p>
            <div className="dacts"><button type="button" className="btn pri" onClick={() => ctx.setSendOpen(false)}>Entendi</button></div>
          </>
        ) : (
          <>
            <p className="muted">
              O cliente abre a cotação <b style={{ color: "var(--fg)" }}>{ctx.nome}</b> e vê só os <b style={{ color: "var(--fg)" }}>{count} {count === 1 ? "plano escolhido" : "planos escolhidos"}</b>, com valores e todos os detalhes, como estão agora.
            </p>
            <label className="lbl" htmlFor="dLink">Link da cotação</label>
            <div className="linkrow">
              <input id="dLink" readOnly value={ctx.shareUrl ?? "Gerando link…"} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn pri" disabled={!ctx.shareUrl} onClick={() => void copy()}>{copied ? "Copiado" : "Copiar link"}</button>
            </div>
            <div className="dacts">
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-disabled={!ctx.shareUrl}>Enviar pelo WhatsApp</a>
              <button type="button" className="btn" disabled={!ctx.shareUrl} onClick={() => ctx.shareUrl && window.open(ctx.shareUrl, "_blank", "noopener")}>Ver como o cliente</button>
            </div>
            <p className="dnote">O link guarda a cotação como está agora. Se mudar vidas ou filtros depois, gere um link novo.</p>
          </>
        )}
      </div>
    </>
  );
}
