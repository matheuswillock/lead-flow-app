"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateRangeFilterProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}

function isoToBr(iso: string): string {
  if (!iso) return ""
  const [year, month, day] = iso.split("-")
  if (!year || !month || !day) return ""
  return `${day}/${month}/${year}`
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function brToIso(br: string): string | null {
  const digits = br.replace(/\D/g, "")
  if (digits.length === 0) return ""
  if (digits.length !== 8) return null

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) {
    return null
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function DateTextInput({
  id,
  label,
  isoValue,
  onIsoChange,
}: {
  id: string
  label: string
  isoValue: string
  onIsoChange: (iso: string) => void
}) {
  const [display, setDisplay] = useState(() => isoToBr(isoValue))

  useEffect(() => {
    setDisplay(isoToBr(isoValue))
  }, [isoValue])

  function commit(nextDisplay: string) {
    const iso = brToIso(nextDisplay)
    if (iso === null) {
      setDisplay(isoToBr(isoValue))
      return
    }
    onIsoChange(iso)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={display}
        onChange={(event) => {
          const masked = maskDate(event.target.value)
          setDisplay(masked)
          const iso = brToIso(masked)
          if (iso !== null) {
            onIsoChange(iso)
          }
        }}
        onBlur={() => commit(display)}
      />
    </div>
  )
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <DateTextInput
        id="founded-from"
        label="De"
        isoValue={from}
        onIsoChange={(nextFrom) => onChange(nextFrom, to)}
      />
      <DateTextInput
        id="founded-to"
        label="Até"
        isoValue={to}
        onIsoChange={(nextTo) => onChange(from, nextTo)}
      />
    </div>
  )
}
