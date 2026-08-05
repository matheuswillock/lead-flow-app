"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionHook"
import type { CnaeOption } from "../services/IBackofficeLeadExtractionService"

interface CnaeComboboxProps {
  value: string
  onChange: (value: string) => void
}

export function CnaeCombobox({ value, onChange }: CnaeComboboxProps) {
  const { searchCnaes } = useBackofficeLeadExtraction()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<CnaeOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  const fetchOptions = useCallback(
    async (q: string) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)
      try {
        const items = await searchCnaes(q || undefined)
        setOptions(items)
      } catch {
        // silencia erro de rede na busca
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [searchCnaes]
  )

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void fetchOptions(query), query ? 300 : 0)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, query, fetchOptions])

  const selected = options.find((o) => o.code === value)
  const displayLabel = selected
    ? `${selected.code} — ${selected.name}`
    : value || null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", value && "border-primary")}
        >
          <span className={cn("truncate", !displayLabel && "text-muted-foreground")}>
            {displayLabel ?? "Selecionar CNAE…"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por código ou descrição…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Buscando…
              </div>
            ) : (
              <>
                <CommandEmpty>Nenhum CNAE encontrado.</CommandEmpty>
                <CommandGroup>
                  {value && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onChange("")
                        setOpen(false)
                      }}
                      className="italic text-muted-foreground"
                    >
                      Limpar seleção
                    </CommandItem>
                  )}
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.code}
                      value={opt.code}
                      onSelect={() => {
                        onChange(opt.code)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          value === opt.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="mr-2 shrink-0 font-mono text-xs text-muted-foreground">
                        {opt.code}
                      </span>
                      <span className="truncate">{opt.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
