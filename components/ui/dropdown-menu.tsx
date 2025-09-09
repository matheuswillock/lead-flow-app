"use client"
import * as React from 'react'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export const DropdownMenuGroup = DropdownPrimitive.Group
export const DropdownMenuPortal = DropdownPrimitive.Portal
export const DropdownMenuSub = DropdownPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup

export function DropdownMenuSubTrigger({ className, inset, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger> & { inset?: boolean }) {
  return (
    <DropdownPrimitive.SubTrigger
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted',
        inset && 'pl-8',
        className
      )}
      {...props}
    >
      {children}
      <span className="ml-auto">›</span>
    </DropdownPrimitive.SubTrigger>
  )
}

export const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.SubContent>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>>(({ className, ...props }, ref) => (
  <DropdownPrimitive.SubContent ref={ref} className={cn('z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out', className)} {...props} />
))
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent'

export const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn('z-50 min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out', className)}
      {...props}
    />
  </DropdownPrimitive.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>>(({ className, inset, ...props }: any, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50', inset && 'pl-8', className)}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>>(({ className, inset, ...props }: any, ref) => (
  <DropdownPrimitive.Label ref={ref} className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', inset && 'pl-8', className)} {...props} />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

export const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof DropdownPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
}
