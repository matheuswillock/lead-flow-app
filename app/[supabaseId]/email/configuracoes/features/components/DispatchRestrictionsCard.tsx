"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import type { BlockedDateRange } from "../context/EmailSettingsTypes"

function formatBlockedEntry(entry: BlockedDateRange): string {
  if ("date" in entry) return entry.date
  return `${entry.from} – ${entry.to}`
}

export function DispatchRestrictionsCard() {
  const {
    loading,
    saving,
    dispatchBlockedDates,
    dispatchTimeFrom,
    dispatchTimeTo,
    setDispatchTimeFrom,
    setDispatchTimeTo,
    addBlockedDate,
    removeBlockedDate,
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
    } else {
      if (!rangeFrom || !rangeTo) return
      addBlockedDate({ from: rangeFrom, to: rangeTo })
      setRangeFrom("")
      setRangeTo("")
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Restrições de disparo</CardTitle>
        <CardDescription>
          Bloqueie datas específicas ou defina uma janela de horário para envio de campanhas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label>Janela de horário permitido (UTC)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="timeFrom" className="text-xs text-muted-foreground">
                    Início
                  </Label>
                  <Input
                    id="timeFrom"
                    type="time"
                    value={dispatchTimeFrom}
                    onChange={(e) => setDispatchTimeFrom(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="timeTo" className="text-xs text-muted-foreground">
                    Fim
                  </Label>
                  <Input
                    id="timeTo"
                    type="time"
                    value={dispatchTimeTo}
                    onChange={(e) => setDispatchTimeTo(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para não restringir por horário.
              </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <Label>Datas bloqueadas</Label>

              {dispatchBlockedDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dispatchBlockedDates.map((entry, i) => (
                    <Badge key={i} variant="secondary" className="gap-1.5 pr-1.5">
                      {formatBlockedEntry(entry)}
                      <button
                        type="button"
                        onClick={() => removeBlockedDate(i)}
                        className="rounded-sm hover:text-destructive"
                        disabled={saving}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("single")}
                >
                  Data única
                </Button>
                <Button
                  type="button"
                  variant={mode === "range" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("range")}
                >
                  Período
                </Button>
              </div>

              {mode === "single" ? (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    disabled={saving}
                    className="max-w-48"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={!singleDate || saving}>
                    Adicionar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Input
                      type="date"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      disabled={saving}
                      className="w-40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Input
                      type="date"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      disabled={saving}
                      className="w-40"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAdd}
                    disabled={!rangeFrom || !rangeTo || saving}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
