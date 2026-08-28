"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdquirirCreditos } from "../context/AdquirirCreditosHook";

export function AdquirirCreditosContainer() {
  const {
    email,
    open,
    loading,
    fieldError,
    handleOpen,
    handleOpenChange,
    handleEmailChange,
    handleConfirm,
  } = useAdquirirCreditos();

  return (
    <>
      <style>{`
        .ec-page {
          --ec-bg: #F6F4F0;
          --ec-card: #ffffff;
          --ec-ink: #181612;
          --ec-ink-soft: #52504A;
          --ec-ink-faint: #9A978F;
          --ec-line: #E4E0D8;
        }
      `}</style>

      <div className="ec-page min-h-screen" style={{ background: "var(--ec-bg)", color: "var(--ec-ink)" }}>
        <div className="fixed inset-0" aria-hidden style={{ background: "var(--ec-bg)", zIndex: 0 }} />

        <div className="relative" style={{ zIndex: 1 }}>
          <div className="mx-auto w-full max-w-[720px] px-6">
            <div className="flex items-center gap-2.5 py-6 text-sm tracking-wide">
              <span className="size-[7px] rounded-full" style={{ background: "var(--primary)" }} />
              <span className="font-medium">Corretor Studio</span>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-[720px] flex-col px-6 pb-14 pt-6">
            <div className="mb-9">
              <div className="mb-3 flex items-center gap-2.5 text-xs tracking-[0.06em] uppercase" style={{ color: "var(--ec-ink-soft)" }}>
                <span className="h-px w-6" style={{ background: "var(--primary)" }} />
                Disparo de E-mail
              </div>
              <h1 className="text-[clamp(24px,3.4vw,30px)] font-medium tracking-[-0.015em]">
                Ative seu volume mensal de disparo
              </h1>
              <p className="mt-2.5 max-w-[480px] text-[15px] leading-relaxed font-light" style={{ color: "var(--ec-ink-soft)" }}>
                Editor de template, organização de contatos, segmentação por formulário e métricas de entrega, abertura e clique inclusos em
                qualquer plano. Escolha o volume e ative.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--ec-line)" }}>
                <p className="text-base font-medium">
                  25 mil <span className="text-sm font-light" style={{ color: "var(--ec-ink-soft)" }}>disparos/mês</span>
                </p>
                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-sm" style={{ color: "var(--ec-ink-soft)" }}>R$</span>
                  <span className="text-[32px] font-medium tracking-[-0.02em]">375</span>
                  <span className="text-[13px]" style={{ color: "var(--ec-ink-soft)" }}>/mês</span>
                </div>
                <Button
                  className="mt-5 w-full rounded-lg"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  onClick={() => handleOpen("25k")}
                >
                  Ativar
                </Button>
              </div>

              <div
                className="relative rounded-[14px] border bg-white p-6"
                style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, var(--ec-line))" }}
              >
                <span
                  className="absolute -top-2.5 right-5 rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.05em] uppercase text-white"
                  style={{ background: "var(--primary)" }}
                >
                  Mais volume
                </span>
                <p className="text-base font-medium">
                  50 mil <span className="text-sm font-light" style={{ color: "var(--ec-ink-soft)" }}>disparos/mês</span>
                </p>
                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="text-sm" style={{ color: "var(--ec-ink-soft)" }}>R$</span>
                  <span className="text-[32px] font-medium tracking-[-0.02em]">650</span>
                  <span className="text-[13px]" style={{ color: "var(--ec-ink-soft)" }}>/mês</span>
                </div>
                <Button
                  className="mt-5 w-full rounded-lg"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  onClick={() => handleOpen("50k")}
                >
                  Ativar
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-xl border bg-white p-4" style={{ borderColor: "var(--ec-line)" }}>
              <p className="text-xs leading-relaxed font-light" style={{ color: "var(--ec-ink-soft)" }}>
                <span className="font-medium" style={{ color: "var(--ec-ink)" }}>
                  Validade de 30 dias.
                </span>{" "}
                Créditos não são cumulativos: o saldo não utilizado expira ao fim do ciclo. A cada renovação — mediante pagamento do próximo ciclo — o volume é restabelecido integralmente conforme o plano ativo. Dá pra trocar de plano quando
                quiser.
              </p>
            </div>
          </div>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-[440px] max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Confirme seu e-mail</DialogTitle>
              <DialogDescription>
                Informe o e-mail da sua conta no Corretor Studio para liberar o checkout.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field>
                <Label htmlFor="ec-email">E-mail da conta</Label>
                <Input
                  id="ec-email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => handleEmailChange(event.target.value)}
                  aria-invalid={fieldError ? true : undefined}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleConfirm();
                    }
                  }}
                />
                {fieldError ? (
                  <p className="text-xs" style={{ color: "var(--destructive)" }}>
                    {fieldError}
                  </p>
                ) : null}
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleConfirm()} disabled={loading || !email.trim()}>
                {loading ? "Validando..." : "Continuar para pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}