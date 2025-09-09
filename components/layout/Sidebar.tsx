"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, KanbanSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/context/AuthContext'
import { NavUser } from '@/components/layout/NavUser'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/board', label: 'Board', icon: KanbanSquare },
]

export function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname()
  useAuth() // garante re-render quando auth mudar
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 transition-transform md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border/60">
        <span className="inline-block h-6 w-6 rounded-md bg-primary" />
        <span className="font-semibold tracking-tight">Lead Flow</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-border/60">
        <NavUser />
      </div>
    </aside>
  )
}
