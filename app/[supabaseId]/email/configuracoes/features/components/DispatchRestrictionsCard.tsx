"use client"

import { useState } from "react"
import { Ban, LoaderCircle, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { BlockedDateRange } from "../context/EmailSettingsTypes"
import { EmailSettingsSectionCard } from "./EmailSettingsSectionCard"

function formatBlockedEntry(entry: BlockedDateRange): string {
  if ("date" in entry) return entry.date
  return `${entry.from} até ${entry.to}`
}

const days = Array.from({ length: 31 }, (_, index) => index + 1)

export function DispatchRestrictionsCard() {
  const {
    loading,
    saving,
    dispatchBlockedDates,
    dispatchTimeFrom,
    dispatchTimeTo,
    blockedDispatchDays,
    setDispatchTimeFrom,
    setDispatchTimeTo,
    addBlockedDate,
    removeBlockedDate,
    toggleBlockedDispatchDay,
  } = useEmailSettingsContext()
  const [singleDate, setSingleDate] = useState("")
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")
  const [mode, setMode] = useState<"single" | "range">("single")

  function handleAdd() {
    if (mode === "single") {
      if (!singleDate) return
      addBlockedDate({ date: singleDate })
      setSingleDate("")
      return
    }

    if (!rangeFrom || !rangeTo) return
    addBlockedDate({ from: rangeFrom, to: rangeTo })
    setRangeFrom("")
    setRangeTo("")
  }

  return (
    <EmailSettingsSectionCard
      icon={Ban}
      title="Restrições de disparo"
      description="Defina janelas seguras para envio, bloqueie datas específicas e evite dias fixos do mês."
      contentClassName="flex flex-col gap-6"
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <FieldGroup>
            <Field>
              <FieldLabel>Janela de horário permitida</FieldLabel>
              <FieldContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="dispatch-time-from">Início</FieldLabel>
                    <FieldContent>
                      <Input
                        id="dispatch-time-from"
                        type="time"
                        value={dispatchTimeFrom}
                        onChange={(event) => setDispatchTimeFrom(event.target.value)}
                        disabled={saving}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="dispatch-time-to">Fim</FieldLabel>
                    <FieldContent>
                      <Input
                        id="dispatch-time-to"
                        type="time"
                        value={dispatchTimeTo}
                        onChange={(event) => setDispatchTimeTo(event.target.value)}
                        disabled={saving}
                      />
                    </FieldContent>
                  </Field>
                </div>
                <FieldDescription>Deixe ambos em branco para não restringir disparos por horário.</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>

          <FieldSeparator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Datas bloqueadas</p>
              <p className="text-sm text-muted-foreground">Cadastre feriados, campanhas pausadas ou períodos de exceção.</p>
            </div>

            {dispatchBlockedDates.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dispatchBlockedDates.map((entry, index) => (
                  <Badge key={`${formatBlockedEntry(entry)}-${index}`} variant="outline" className="gap-1.5 rounded-lg border-border bg-background/90 pr-1.5 text-foreground">
                    {formatBlockedEntry(entry)}
                    <button
                      type="button"
                      onClick={() => removeBlockedDate(index)}
                      disabled={saving}
                      className="rounded-sm p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button type="button" variant={mode === "single" ? "default" : "outline"} size="sm" onClick={() => setMode("single")}>
                Data única
              </Button>
              <Button type="button" variant={mode === "range" ? "default" : "outline"} size="sm" onClick={() => setMode("range")}>
                Período
              </Button>
            </div>

            {mode === "single" ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field className="min-w-[220px]">
                  <FieldLabel htmlFor="dispatch-single-date">Data</FieldLabel>
                  <FieldContent>
                    <Input
                      id="dispatch-single-date"
                      type="date"
                      value={singleDate}
                      onChange={(event) => setSingleDate(event.target.value)}
                      disabled={saving}
                    />
                  </FieldContent>
                </Field>
                <Button type="button" variant="outline" onClick={handleAdd} disabled={!singleDate || saving}>
                  Adicionar
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Field>
                  <FieldLabel htmlFor="dispatch-range-from">De</FieldLabel>
                  <FieldContent>
                    <Input
                      id="dispatch-range-from"
                      type="date"
                      value={rangeFrom}
                      onChange={(event) => setRangeFrom(event.target.value)}
                      disabled={saving}
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel htmlFor="dispatch-range-to">Até</FieldLabel>
                  <FieldContent>
                    <Input
                      id="dispatch-range-to"
                      type="date"
                      value={rangeTo}
                      onChange={(event) => setRangeTo(event.target.value)}
                      disabled={saving}
                    />
                  </FieldContent>
                </Field>
                <Button type="button" variant="outline" onClick={handleAdd} disabled={!rangeFrom || !rangeTo || saving}>
                  Adicionar
                </Button>
              </div>
            )}
          </div>

          <FieldSeparator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Dias do mês bloqueados</p>
              <p className="text-sm text-muted-foreground">Use para impedir disparos recorrentes em dias específicos, como fechamento ou faturamento.</p>
            </div>

            <div className="grid grid-cols-7 gap-2 md:grid-cols-10">
              {days.map((day) => {
                const active = blockedDispatchDays.includes(day)

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleBlockedDispatchDay(day)}
                    disabled={saving}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-xl border text-sm font-medium transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-[var(--precision-shadow-1)]"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {saving ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Salvando restrições...
            </div>
          ) : null}
        </>
      )}
    </EmailSettingsSectionCard>
  )
}
