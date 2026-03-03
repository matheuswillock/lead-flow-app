"use client"
import Link from "next/link"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Bell, CircleUser, CreditCard, EllipsisVertical, LogOut } from "lucide-react"
import { useTransition } from "react"
import { signout } from "@/app/actions/auth"
import { useUser } from "@/app/context/UserContext"
import { NavLink } from "@/components/ui/nav-link"
import { useNotifications } from "@/app/[supabaseId]/notifications/features/context/NotificationsHook"

export function NavUser({
  supabaseId,
}: {
  supabaseId?: string
}) {
  const { user } = useUser();
  const { isMobile } = useSidebar()
  const [isPending, startTransition] = useTransition()
  const { unreadCount } = useNotifications();
  
  const isMaster = user?.isMaster === true;
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const getInitials = (name: string) => {
    const words = name.trim().split(' ').filter(word => word.length > 0);
    if (words.length === 0) return 'LF';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const userData = user ? {
    name: user.fullName || "Usuário",
    email: user.email,
    avatar: user.profileIconUrl ?? `https://avatar.vercel.sh/${user.email}.png`,
    initials: getInitials(user.fullName || "Corretor Studio"),
  } : {
    name: "Carregando...",
    email: "carregando@example.com",
    avatar: `https://avatar.vercel.sh/guest.png`,
    initials: "LF",
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={userData.avatar} alt={userData.name} />
                <AvatarFallback className="rounded-lg">{userData.initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userData.name}</span>
                <span className="text-muted-foreground truncate text-xs">{userData.email}</span>
              </div>
              <div className="relative ml-auto">
                <EllipsisVertical className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {unreadLabel}
                  </span>
                )}
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={userData.avatar} alt={userData.name} />
                  <AvatarFallback className="rounded-lg">{userData.initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userData.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{userData.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link
                  href={`/${supabaseId}/notifications`}
                  className="flex w-full items-center gap-2 text-sm"
                >
                  <Bell className="size-4" />
                  <span className="flex-1">Notificações</span>
                  {unreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1 text-xs font-medium text-primary">
                      {unreadLabel}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <NavLink
                  icon={CircleUser}
                  href={`/${supabaseId}/account`}
                  text="Minha Conta"
                  className="w-full"
                />
              </DropdownMenuItem>
              {isMaster && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <NavLink
                    icon={CreditCard}
                    href={`/${supabaseId}/subscription`}
                    text="Assinatura"
                    className="w-full"
                  />
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={isPending}
              onSelect={(e) => {
                e.preventDefault()
                startTransition(() => {
                  void signout()
                })
              }}
            >
              <LogOut />
              {isPending ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
