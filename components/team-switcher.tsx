"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
  activeTeamId,
  onChange,
  variant = "default",
  inline = false,
}: {
  teams: {
    id: string
    name: string
  }[]
  activeTeamId: string | null
  onChange: (teamId: string) => void
  variant?: "default" | "compact"
  inline?: boolean
}) {
  const { isMobile } = useSidebar()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const activeTeam = React.useMemo(
    () => teams.find((team) => team.id === activeTeamId) || teams[0],
    [teams, activeTeamId]
  )
  const filteredTeams = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    if (!normalizedQuery) {
      return teams
    }

    return teams.filter((team) =>
      team.name.toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [teams, query])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!activeTeam) {
    return null
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      setQuery("")
    }
  }

  const handleSelectTeam = (teamId: string) => {
    onChange(teamId)
    setOpen(false)
    setQuery("")
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-start gap-2 rounded-md px-2 py-1 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <ChevronsUpDown className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{activeTeam.name}</span>
      </button>
    ) : (
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold">
          {activeTeam.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{activeTeam.name}</span>
          <span className="truncate text-xs">Time ativo</span>
        </div>
        <ChevronsUpDown className="ml-auto" />
      </SidebarMenuButton>
    )

  const menu = (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="h-[90dvh] max-h-[90dvh] w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[calc(100vw-1rem)] rounded-lg p-0"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <Command shouldFilter={false} className="flex h-full flex-col rounded-lg">
          <div className="px-2 pt-2">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Times</p>
          </div>
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Pesquisar time pelo nome"
          />
          <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
            {filteredTeams.length === 0 ? (
              <CommandEmpty>Nenhum time encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredTeams.map((team) => (
                  <CommandItem
                    key={team.id}
                    value={team.name}
                    onSelect={() => handleSelectTeam(team.id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate">{team.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )

  if (inline) {
    return menu
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>{menu}</SidebarMenuItem>
    </SidebarMenu>
  )
}
