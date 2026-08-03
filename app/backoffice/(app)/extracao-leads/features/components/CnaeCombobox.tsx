"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
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
import { CNAE_LIST } from "../data/cnae-list"

interface CnaeComboboxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function CnaeCombobox({ value, onChange, placeholder = "Ramo de atividade (CNAE)" }: CnaeComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = CNAE_LIST.find((c) => c.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Pesquisar CNAE..." />
          <CommandList>
            <CommandEmpty>Nenhum CNAE encontrado.</CommandEmpty>
            <CommandGroup>
              {CNAE_LIST.map((cnae) => (
                <CommandItem
                  key={cnae.value}
                  value={cnae.label}
                  onSelect={() => {
                    onChange(cnae.value === value ? "" : cnae.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn("mr-2 size-4", value === cnae.value ? "opacity-100" : "opacity-0")}
                  />
                  {cnae.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
