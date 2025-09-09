"use client"
import { Menu, X, LogOut, User, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '@/app/context/AuthContext'
import { useEffect } from 'react'
import { useTheme } from 'next-themes'

interface TopbarProps {
  open: boolean
  onToggle: () => void
}

export function Topbar({ open, onToggle }: TopbarProps) {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()

  // Keyboard shortcut: Ctrl/Cmd + J to toggle theme
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modifier = isMac ? e.metaKey : e.ctrlKey
      if (modifier && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault()
        setTheme(theme === 'dark' ? 'light' : 'dark')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [theme, setTheme])
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="outline"
        size="icon"
        className="md:hidden"
        onClick={onToggle}
        aria-label="Alternar navegação"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Alternar tema"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        {user && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs flex items-center gap-1"
                aria-label="Abrir menu do usuário"
              >
                <User className="size-3" /> {user.email?.split('@')[0]}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
              >
                <div className="px-2 py-1.5 text-xs text-muted-foreground max-w-full truncate" title={user.email || ''}>{user.email}</div>
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                <DropdownMenu.Item asChild>
                  <button
                    onClick={signOut}
                    className="flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-muted focus:bg-muted"
                  >
                    <LogOut className="size-3" /> Sair
                  </button>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                <div className="px-2 pb-1 pt-0 text-[10px] text-muted-foreground">Tema: Ctrl/Cmd + J</div>
                <DropdownMenu.Arrow className="fill-border" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </header>
  )
}
