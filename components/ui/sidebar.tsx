"use client"
// Lightweight implementation inspired by shadcn/ui dashboard-01 sidebar primitives
// Provides enough structure for SidebarHeader/Content/Footer, groups and user menu.
import * as React from 'react'
import { cn } from '@/lib/utils'

type SidebarContextValue = {
  isMobile: boolean
  open: boolean
  toggle: () => void
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)
export const useSidebar = () => {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside <SidebarProvider>')
  return ctx
}

export interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean
  style?: React.CSSProperties
}

export function SidebarProvider({ children, defaultOpen = true, style, ...rest }: SidebarProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // hydrate persisted state
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('lf-sidebar-open') : null
    if (stored !== null) {
      setOpen(stored === 'true')
    }
  }, [])

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const listener = () => setIsMobile(mq.matches)
    listener()
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  React.useEffect(() => {
    try { window.localStorage.setItem('lf-sidebar-open', String(open)) } catch {}
  }, [open])

  const value: SidebarContextValue = React.useMemo(() => ({
    isMobile,
    open,
    toggle: () => setOpen(o => !o),
    setOpen,
  }), [isMobile, open])

  return (
    <SidebarContext.Provider value={value}>
      <div
        {...rest}
        style={style}
        className={cn('relative flex min-h-screen w-full bg-background text-foreground [&_a]:outline-none', rest.className)}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// Root sidebar shell
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  collapsible?: 'offcanvas' | 'icon' | 'none'
  variant?: 'default' | 'inset'
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { className, collapsible = 'offcanvas', variant = 'default', ...props }, ref) {
  const { open, isMobile } = useSidebar()
  const width = 'var(--sidebar-width, 15rem)'
  return (
    <aside
      ref={ref}
      data-collapsible={collapsible}
      data-variant={variant}
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'group/sidebar-wrapper z-40 flex h-screen flex-col border-r bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50 transition-all duration-200',
        collapsible === 'offcanvas' && [
          open
            ? 'w-[--sidebar-width]'
            : 'translate-x-[-100%] md:translate-x-0 md:w-[--sidebar-collapsed-width,4rem]'
        ],
        collapsible === 'icon' && [
          open ? 'w-[--sidebar-width]' : 'w-[--sidebar-collapsed-width,4rem]'
        ],
        isMobile && 'fixed inset-y-0 left-0',
        !isMobile && 'sticky top-0',
        className
      )}
      style={{ ['--sidebar-width' as any]: width }}
      {...props}
    />
  )
})

export const SidebarHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex h-14 items-center border-b px-3', className)} {...props} />
)
export const SidebarContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto p-3', className)} {...props} />
)
export const SidebarFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto border-t p-3', className)} {...props} />
)

export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Container for the page content next to the sidebar
  return <div className={cn('flex flex-1 flex-col', className)} {...props} />
}

// Group wrappers
export const SidebarGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2', className)} {...props} />
)
export const SidebarGroupLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide', className)} {...props} />
)
export const SidebarGroupContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2', className)} {...props} />
)

export function SidebarMenu({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />
}
export function SidebarMenuItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col', className)} {...props} />
}
import { Slot } from '@radix-ui/react-slot'
export const SidebarMenuButton = React.forwardRef<
  HTMLElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean; tooltip?: string; size?: 'sm' | 'lg' }
>(function SidebarMenuButton({ className, children, size, asChild, ...rest }, ref) {
  const { open } = useSidebar()
  const Comp: any = asChild ? Slot : 'button'
  // Remove asChild from passed props
  const props = { ...rest }
  return (
    <Comp
      ref={ref}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium outline-none transition-colors',
        'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
        size === 'lg' && 'py-3',
        !open && 'justify-center',
        className
      )}
      {...props}
    >
      {React.Children.map(children, child => {
        if (typeof child === 'string') return open ? child : null
        if (React.isValidElement(child)) {
          if (!open && child.type === 'span') return null
        }
        return child
      })}
    </Comp>
  )
})

export const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { showOnHover?: boolean }
>(function SidebarMenuAction({ className, showOnHover, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-sm p-1 text-xs text-muted-foreground hover:bg-muted',
        showOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity',
        className
      )}
      {...props}
    />
  )
})

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function SidebarTrigger(
  { className, ...props }, ref) {
  const { toggle } = useSidebar()
  return (
    <button
      ref={ref}
      onClick={toggle}
      className={cn('inline-flex size-8 items-center justify-center rounded-md border bg-background hover:bg-muted', className)}
      aria-label="Alternar menu"
      {...props}
    >
      <span className="i-lucide-menu size-4" />
    </button>
  )
})

