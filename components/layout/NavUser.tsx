"use client"
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from '@tabler/icons-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/context/AuthContext'

export function NavUser() {
  const { user, signOut } = useAuth()
  const { isMobile } = useSidebar()
  if (!user) return null
  const name = user.email?.split('@')[0] || 'user'
  const email = user.email || ''
  const avatar = `https://avatar.vercel.sh/${encodeURIComponent(name)}.png`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'group flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left text-sm transition',
            'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
          )}
          aria-label="Menu do usuário"
        >
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback className="rounded-md text-xs font-medium">{name.slice(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <IconDotsVertical className="size-4 opacity-70 group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        side={isMobile ? 'top' : 'right'}
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback className="rounded-md text-xs font-medium">{name.slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="gap-2">
            <IconUserCircle className="size-4" /> Account
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <IconCreditCard className="size-4" /> Billing
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <IconNotification className="size-4" /> Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
          <IconLogout className="size-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
