"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const activeTeam = React.useMemo(
    () => teams.find((team) => team.id === activeTeamId) || teams[0],
    [teams, activeTeamId]
  )

  if (!activeTeam) {
    return null
  }

  const trigger =
    variant === "compact" ? (
      <button
        type="button"
        className="cursor-pointer flex w-full items-center justify-start gap-2 rounded-md px-2 py-1 text-xs font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <ChevronsUpDown className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{activeTeam.name}</span>
      </button>
    ) : (
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-semibold cursor-pointer">
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">Times</DropdownMenuLabel>
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => onChange(team.id)}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
              {team.name.slice(0, 2).toUpperCase()}
            </div>
            {team.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
