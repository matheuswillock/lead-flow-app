'use client';

import { Infinity as InfinityIcon, Layers, UserRound } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { BillingGraceCycleQuote } from "../context/BillingGracePaymentTypes";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export const formatBRL = (value: number) => BRL.format(value);
export const formatPeriod = (quote: Pick<BillingGraceCycleQuote, "periodStart" | "periodEnd">) =>
  `${DATE.format(new Date(quote.periodStart))} a ${DATE.format(new Date(quote.periodEnd))}`;

/** Prazo da renovação: cada opção mostra o total no PIX e o equivalente por mês. */
export function BillingGraceCycleChoice({ cycles, value, disabled, onChange }: {
  cycles: BillingGraceCycleQuote[]
  value: string
  disabled: boolean
  onChange: (cycle: string) => void
}) {
  return (
    <section aria-labelledby="renewal-cycle-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="renewal-cycle-title" className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">Período do plano</h2>
        <p className="text-sm text-muted-foreground">O novo período começa no seu último vencimento.</p>
      </div>
      <RadioGroup
        aria-labelledby="renewal-cycle-title"
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {cycles.map((quote) => {
          const selected = quote.cycle === value;
          const labelId = `renewal-cycle-${quote.cycle}`;
          return (
            <div
              key={quote.cycle}
              className={cn(
                "relative flex min-w-0 flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 transition-colors duration-[var(--motion-duration-base)]",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40",
                disabled && "opacity-60",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span id={labelId} className="text-sm font-semibold text-foreground">{quote.label}</span>
                <span className="font-display text-base font-bold tracking-[-0.01em] text-foreground tabular-nums">
                  {formatBRL(quote.pixTotal)}
                </span>
              </span>
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                <span>{formatPeriod(quote)}</span>
                {quote.months > 1 ? <span className="tabular-nums">{formatBRL(quote.pixTotal / quote.months)}/mês</span> : null}
              </span>
              {quote.unlimitedUsers ? (
                <span className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-semibold text-semantic-success">
                  <InfinityIcon className="size-3.5" aria-hidden />
                  Usuários ilimitados
                </span>
              ) : null}
              <RadioGroupItem
                value={quote.cycle}
                aria-labelledby={labelId}
                className="absolute inset-0 aspect-auto size-full rounded-xl border-0 text-transparent disabled:cursor-not-allowed"
              />
            </div>
          );
        })}
      </RadioGroup>
    </section>
  );
}

function ChargeGroup({ icon, title, total, children }: {
  icon: React.ReactNode
  title: string
  total: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-foreground">{icon}{title}</span>
        <span className="font-semibold text-foreground tabular-nums">{formatBRL(total)}</span>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">{children}</ul>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { manager: "Manager", operator: "Operador" };

/**
 * Valores do prazo com só os usuários que o master manteve. O servidor recalcula o mesmo valor
 * ao gerar a cobrança; aqui é só para a tela acompanhar a escolha.
 */
export function applyKeptUsers(quote: BillingGraceCycleQuote, keptUserIds: ReadonlySet<string>): BillingGraceCycleQuote {
  if (quote.unlimitedUsers) return quote;
  const billedUsers = quote.accountUsers.filter((user) => keptUserIds.has(user.id));
  const round = (value: number) => Math.round(value * 100) / 100;
  // extraUserPrice é o valor mensal do usuário: cobra-se vezes os meses do prazo.
  const extraUsersTotal = round(billedUsers.length * quote.extraUserPrice * quote.months);
  const difference = round(extraUsersTotal - quote.extraUsersTotal);
  return {
    ...quote,
    billedUsers,
    extraUsersTotal,
    pixTotal: round(quote.pixTotal + difference),
    cardTotal: quote.cardTotal == null ? null : round(quote.cardTotal + difference),
  };
}

/** Uma linha por usuário: marcado segue na conta e é cobrado; desmarcado sai ao confirmar o pagamento. */
function KeepUserRow({ user, price, kept, disabled, onToggle }: {
  user: BillingGraceCycleQuote["accountUsers"][number]
  price: number
  kept: boolean
  disabled: boolean
  onToggle: (kept: boolean) => void
}) {
  const inputId = `renewal-keep-${user.id}`;
  return (
    <li className={cn("flex items-start gap-3 px-4 py-3 text-sm", !kept && "bg-muted/40")}>
      <input
        id={inputId}
        type="checkbox"
        checked={kept}
        disabled={disabled}
        onChange={(event) => onToggle(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
      />
      <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 font-medium text-foreground [overflow-wrap:anywhere]">
          {user.name}
          <span className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[user.role] ?? "Usuário"}</span>
        </span>
        <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{user.email}</span>
        {kept ? null : (
          <span className="text-xs font-medium text-destructive">Perde o acesso quando o pagamento for confirmado</span>
        )}
      </label>
      <span className={cn("shrink-0 tabular-nums", kept ? "text-muted-foreground" : "text-muted-foreground line-through")}>
        {formatBRL(price)}
      </span>
    </li>
  );
}

/**
 * Tudo o que entra na renovação, pelo nome: o plano, cada usuário adicional (nome e e-mail) e
 * cada time adicional. Quando o prazo tem ilimitado, os usuários aparecem como incluídos.
 */
export function BillingGraceBilledItems({ quote, keptUserIds, disabled, onToggleUser }: {
  quote: BillingGraceCycleQuote
  keptUserIds: ReadonlySet<string>
  disabled: boolean
  onToggleUser: (userId: string, kept: boolean) => void
}) {
  return (
    <section aria-labelledby="renewal-items-title" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-1">
        <h2 id="renewal-items-title" className="font-display text-xl leading-tight font-extrabold tracking-[-0.02em] text-foreground">
          O que está sendo renovado
        </h2>
        <p className="text-sm text-muted-foreground">Plano {quote.label.toLowerCase()} com 1 usuário e 1 time incluídos.</p>
      </div>

      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">Plano {quote.label}</span>
        <span className="font-semibold text-foreground tabular-nums">{formatBRL(quote.planPixTotal)}</span>
      </div>

      {quote.unlimitedUsers ? (
        <p className="flex items-start gap-2 rounded-xl border border-semantic-success-border bg-semantic-success-surface px-4 py-3 text-sm text-foreground">
          <InfinityIcon className="mt-0.5 size-4 shrink-0 text-semantic-success" aria-hidden />
          Usuários ilimitados incluídos neste prazo, sem cobrança por usuário.
        </p>
      ) : quote.accountUsers.length > 0 ? (
        <ChargeGroup
          icon={<UserRound className="size-4 text-primary" aria-hidden />}
          title={`Usuários adicionais (${quote.billedUsers.length} de ${quote.accountUsers.length})`}
          total={quote.extraUsersTotal}
        >
          {quote.accountUsers.map((user) => (
            <KeepUserRow
              key={user.id}
              user={user}
              price={Math.round(quote.extraUserPrice * quote.months * 100) / 100}
              kept={keptUserIds.has(user.id)}
              disabled={disabled}
              onToggle={(kept) => onToggleUser(user.id, kept)}
            />
          ))}
        </ChargeGroup>
      ) : null}

      {quote.billedTeams.length > 0 ? (
        <ChargeGroup
          icon={<Layers className="size-4 text-primary" aria-hidden />}
          title={`Times adicionais (${quote.billedTeams.length})`}
          total={quote.extraTeamsTotal}
        >
          {quote.billedTeams.map((team, index) => (
            <li key={`${team.name}-${index}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{team.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatBRL(quote.extraTeamPrice)}</span>
            </li>
          ))}
        </ChargeGroup>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Cada usuário adicional é cobrado por mês ({formatBRL(quote.extraUserPrice)}) durante os {quote.months}{" "}
        {quote.months === 1 ? "mês" : "meses"} do prazo; os times têm preço único pelo prazo inteiro. Desmarque quem
        não deve continuar: a pessoa perde o acesso aos times da conta quando o pagamento for confirmado.
      </p>
    </section>
  );
}

/** Usuários adicionais desmarcados: perdem o acesso quando o pagamento confirmar. */
export function revokedUsersOf(quote: BillingGraceCycleQuote): BillingGraceCycleQuote["accountUsers"] {
  if (quote.unlimitedUsers) return [];
  const kept = new Set(quote.billedUsers.map((user) => user.id));
  return quote.accountUsers.filter((user) => !kept.has(user.id));
}

/** "Tem certeza?" antes de pagar quando alguém vai perder o acesso. */
export function BillingGraceRevokeDialog({ revokedUsers, open, onOpenChange, onConfirm }: {
  revokedUsers: BillingGraceCycleQuote["accountUsers"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const count = revokedUsers.length;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remover o acesso de {count === 1 ? "1 pessoa" : `${count} pessoas`}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Quando o pagamento for confirmado, {count === 1 ? "ela sai" : "elas saem"} dos times desta conta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-1 text-sm">
          {revokedUsers.map((user) => (
            <li key={user.id} className="flex min-w-0 flex-col">
              <span className="font-medium text-foreground [overflow-wrap:anywhere]">{user.name}</span>
              <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{user.email}</span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel className="max-lg:min-h-11">Voltar</AlertDialogCancel>
          <AlertDialogAction className="max-lg:min-h-11" onClick={onConfirm}>
            Sim, remover e continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
