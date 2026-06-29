"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"

type TeamSwitcherTeam = {
  id: string
  name: string
  accountName?: string
  isOwnAccount?: boolean
  isAccessible?: boolean
  isAssociateAccount?: boolean
}

export function TeamSwitcher({
  teams,
  activeTeamId,
  onChange,
  variant = "default",
  inline = false,
}: {
  teams: TeamSwitcherTeam[]
  activeTeamId: string | null
  onChange: (teamId: string) => void
  variant?: "default" | "compact"
  inline?: boolean
}) {
  const { isMobile } = useSidebar()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const accessibleTeams = React.useMemo(
    () => teams.filter((team) => team.isAccessible !== false),
    [teams]
  )

  const activeTeam = React.useMemo(
    () => accessibleTeams.find((team) => team.id === activeTeamId) || accessibleTeams[0],
    [accessibleTeams, activeTeamId]
  )

  const filteredTeams = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()

    if (!normalizedQuery) {
      return teams
    }

    return teams.filter((team) => {
      const accountName = team.accountName?.toLocaleLowerCase() ?? ""
      return (
        team.name.toLocaleLowerCase().includes(normalizedQuery) ||
        accountName.includes(normalizedQuery)
      )
    })
  }, [teams, query])

  const groupedTeams = React.useMemo(() => {
    const groups = new Map<string, TeamSwitcherTeam[]>()

    for (const team of filteredTeams) {
      const label = team.isOwnAccount
        ? "Minha conta"
        : team.isAssociateAccount
          ? "Associados"
          : team.accountName || "Outras contas"
      const current = groups.get(label) ?? []
      current.push(team)
      groups.set(label, current)
    }

    return [...groups.entries()]
  }, [filteredTeams])

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

  const handleSelectTeam = (team: TeamSwitcherTeam) => {
    if (team.isAccessible === false) {
      return
    }
    onChange(team.id)
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
          <span className="truncate text-xs">
            {activeTeam.isOwnAccount ? "Minha conta" : activeTeam.accountName || "Time ativo"}
          </span>
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
            placeholder="Pesquisar time ou conta"
          />
          <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
            {filteredTeams.length === 0 ? (
              <CommandEmpty>Nenhum time encontrado.</CommandEmpty>
            ) : (
              groupedTeams.map(([groupLabel, groupTeams]) => (
                <CommandGroup key={groupLabel} heading={groupLabel}>
                  {groupTeams.map((team) => {
                    const disabled = team.isAccessible === false
                    return (
                      <CommandItem
                        key={team.id}
                        value={`${groupLabel}-${team.name}`}
                        onSelect={() => handleSelectTeam(team)}
                        disabled={disabled}
                        className={cn("gap-2 p-2", disabled && "opacity-60")}
                      >
                        <div className="flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
                          {team.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{team.name}</span>
                          {team.isAssociateAccount ? (
                            <Badge
                              variant="outline"
                              className="mt-1 w-fit border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
                            >
                              Associado
                            </Badge>
                          ) : null}
                          {disabled ? (
                            <Badge variant="outline" className="mt-1 w-fit">
                              Assinatura inativa
                            </Badge>
                          ) : null}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))
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
