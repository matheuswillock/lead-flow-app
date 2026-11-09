"use client"

import { ChevronDown, Gift, Infinity, Minus, Plus, UsersRound, UserRound } from "lucide-react"
import { useState, type ComponentType } from "react"

import { Button } from "@/components/ui/button"
import { SELF_CHECKOUT_EXTRAS_MAX, type SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { formatBRL, hasUnlimitedUsers } from "../utils/selfCheckoutForm"

type AddonKind = "extraUsers" | "extraTeams"

type AddonDefinition = {
  kind: AddonKind
  title: string
  description: string
  unitLabel: string
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

const ADDONS: readonly AddonDefinition[] = [
  {
    kind: "extraUsers",
    title: "Usuário adicional",
    description: "Usuário extra na conta",
    unitLabel: "usuário",
    Icon: UserRound,
  },
  {
    kind: "extraTeams",
    title: "Time adicional",
    description: "Time extra na conta",
    unitLabel: "time",
    Icon: UsersRound,
  },
]

function monthlyPriceFor(option: SelfCheckoutCycleOption, kind: AddonKind): number | null {
  const price = kind === "extraUsers" ? option.extraUserMonthlyPrice : option.extraTeamMonthlyPrice
  return typeof price === "number" && price > 0 ? price : null
}

function AddonCard({
  definition,
  monthlyPrice,
  quantity,
  disabled,
  onChange,
}: {
  definition: AddonDefinition
  monthlyPrice: number
  quantity: number
  disabled: boolean
  onChange: (quantity: number) => void
}) {
  const { Icon, title, description, unitLabel, kind } = definition
  const active = quantity > 0
  const titleId = `self-checkout-${kind}-title`

  return (
    <li
      className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        active ? "border-primary/50 bg-primary/[0.03]" : "border-border bg-card"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id={titleId} className="font-display text-base font-bold text-foreground">
            {title}
          </span>
          <span className="text-sm text-muted-foreground">{description}</span>
          <span className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {formatBRL(monthlyPrice)}
            <span className="font-normal text-muted-foreground"> por {unitLabel} no período</span>
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={titleId}
        className="flex shrink-0 items-center gap-1 self-end sm:self-auto"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-9"
          onClick={() => onChange(quantity - 1)}
          disabled={disabled || quantity <= 0}
          aria-label={`Remover ${unitLabel} adicional`}
        >
          <Minus aria-hidden />
        </Button>
        <span
          aria-live="polite"
          className="w-10 text-center font-display text-lg font-bold text-foreground tabular-nums"
        >
          {quantity}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:size-9"
          onClick={() => onChange(quantity + 1)}
          disabled={disabled || quantity >= SELF_CHECKOUT_EXTRAS_MAX}
          aria-label={`Adicionar ${unitLabel} adicional`}
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </li>
  )
}

/** No plano anual os usuários são ilimitados: a caixa fica visível como benefício, sem contador. */
function UnlimitedUsersCard() {
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-semantic-success-border bg-semantic-success/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-semantic-success text-semantic-success-foreground"
        >
          <UserRound className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-base font-bold text-foreground">Usuário adicional</span>
          <span className="text-sm text-muted-foreground">
            Você ganhou usuários ilimitados no plano anual, sem cobrança a mais.
          </span>
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-semantic-success-surface px-2.5 py-0.5 text-xs font-semibold text-semantic-success">
            <Gift className="size-3.5" aria-hidden />
            Benefício do plano anual
          </span>
        </div>
      </div>
      <div
        role="img"
        aria-label="Usuários ilimitados"
        className="flex h-11 min-w-24 shrink-0 items-center justify-center self-end rounded-lg border border-semantic-success-border bg-card text-semantic-success sm:self-auto"
      >
        <Infinity className="size-7" strokeWidth={2.5} aria-hidden />
      </div>
    </li>
  )
}

/**
 * Itens que o cliente pode acrescentar ao plano quantas vezes quiser (até o limite do contrato).
 * Só aparece quando o servidor informa o preço mensal dos adicionais para o ciclo escolhido.
 */
export function SelfCheckoutAddons({
  option,
  extraUsers,
  extraTeams,
  disabled,
  onChange,
}: {
  option: SelfCheckoutCycleOption | null
  extraUsers: number
  extraTeams: number
  disabled: boolean
  onChange: (kind: AddonKind, quantity: number) => void
}) {
  const [open, setOpen] = useState(extraUsers + extraTeams > 0)
  if (!option) return null
  const quantities: Record<AddonKind, number> = { extraUsers, extraTeams }
  const unlimitedUsers = hasUnlimitedUsers(option)
  const available = ADDONS.filter(
    (definition) =>
      monthlyPriceFor(option, definition.kind) !== null &&
      !(unlimitedUsers && definition.kind === "extraUsers"),
  )
  if (available.length === 0 && !unlimitedUsers) return null

  const chosen = extraUsers + extraTeams
  const toggleLabel =
    chosen > 0
      ? `Adicionais escolhidos: ${chosen}`
      : unlimitedUsers
        ? "Precisa de mais times?"
        : "Precisa de mais usuários ou times?"

  return (
    <section aria-labelledby="self-checkout-addons-title" className="flex flex-col gap-4">
      <button
        type="button"
        id="self-checkout-addons-title"
        aria-expanded={open}
        aria-controls="self-checkout-addons-panel"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {toggleLabel}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id="self-checkout-addons-panel" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {unlimitedUsers
              ? "Todos os planos incluem 1 time. No plano anual os usuários são ilimitados."
              : "Todos os planos incluem 1 usuário e 1 time."}{" "}
            Se precisar de mais, acrescente quantos quiser: o valor é único e vale por todo o período
            do plano contratado, parcelável como o plano.
          </p>
          <ul className="flex flex-col gap-3">
            {unlimitedUsers ? <UnlimitedUsersCard /> : null}
            {available.map((definition) => (
              <AddonCard
                key={definition.kind}
                definition={definition}
                monthlyPrice={monthlyPriceFor(option, definition.kind) ?? 0}
                quantity={quantities[definition.kind]}
                disabled={disabled}
                onChange={(quantity) => onChange(definition.kind, quantity)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
