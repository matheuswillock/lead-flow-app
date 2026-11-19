"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePlanSimulatorContext } from "../context/PlanSimulatorContext";

/** Gera o link do cliente (snapshot imutável) e oferece copiar ou enviar pelo WhatsApp. */
export function SendQuoteDialog() {
  const ctx = usePlanSimulatorContext();
  const [copied, setCopied] = useState(false);
  const count = ctx.draft.sel.length;
  const message = ctx.shareUrl
    ? `Olá! Segue a cotação de planos de saúde (${ctx.nome}). Pelo link você vê as operadoras, os planos e os detalhes: ${ctx.shareUrl}`
    : "";

  async function copy() {
    if (!ctx.shareUrl) return;
    await navigator.clipboard.writeText(ctx.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Dialog open={ctx.sendOpen} onOpenChange={(open) => ctx.setSendOpen(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar ao cliente</DialogTitle>
          <DialogDescription>
            O cliente vê só os {count} {count === 1 ? "plano incluído" : "planos incluídos"}, com valores e detalhes, como estão agora.
          </DialogDescription>
        </DialogHeader>

        {ctx.shareUrl ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={ctx.shareUrl} aria-label="Link da cotação" onFocus={(e) => e.target.select()} />
              <Button type="button" onClick={() => void copy()}>
                <Copy className="size-4" />
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Enviar pelo WhatsApp
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Se mudar vidas ou filtros depois, gere um link novo.</p>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" disabled={count === 0} onClick={() => void ctx.share()}>
              Gerar link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
