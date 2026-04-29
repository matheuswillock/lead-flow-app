"use client"

import { useRef, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

export const BACKOFFICE_EMAIL_DOMAIN = "@corretorstudio.com"

export function sanitizeBackofficeEmailPrefix(value: string) {
  const normalized = value.trim().toLowerCase()
  const withoutKnownDomain = normalized.endsWith(BACKOFFICE_EMAIL_DOMAIN)
    ? normalized.slice(0, -BACKOFFICE_EMAIL_DOMAIN.length)
    : normalized

  return withoutKnownDomain.split("@")[0]?.replace(/\s/g, "") ?? ""
}

export function getBackofficeEmailPrefix(email: string) {
  return sanitizeBackofficeEmailPrefix(email)
}

export function buildBackofficeEmail(prefix: string) {
  const sanitizedPrefix = sanitizeBackofficeEmailPrefix(prefix)
  return sanitizedPrefix ? `${sanitizedPrefix}${BACKOFFICE_EMAIL_DOMAIN}` : ""
}

export function isBackofficeEmail(email: string) {
  const prefix = getBackofficeEmailPrefix(email)
  return Boolean(prefix) && email.trim().toLowerCase() === buildBackofficeEmail(prefix)
}

interface BackofficeEmailInputProps
  extends Omit<ComponentProps<"input">, "onChange" | "type" | "value"> {
  value: string
  onValueChange: (email: string) => void
}

export function BackofficeEmailInput({
  value,
  onValueChange,
  className,
  disabled,
  placeholder: _placeholder,
  ...props
}: BackofficeEmailInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const prefix = getBackofficeEmailPrefix(value)

  return (
    <div
      className={cn(
        "flex h-9 w-full cursor-text items-center overflow-hidden rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={() => inputRef.current?.focus()}
      aria-disabled={disabled}
    >
      <span className="relative inline-grid min-w-px max-w-full shrink-0">
        <span className="invisible whitespace-pre" aria-hidden="true">
          {prefix}
        </span>
        <input
          {...props}
          ref={inputRef}
          type="text"
          value={prefix}
          onChange={(event) => onValueChange(buildBackofficeEmail(event.target.value))}
          className="absolute inset-0 min-w-px bg-transparent p-0 outline-none disabled:cursor-not-allowed"
          disabled={disabled}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
        />
      </span>
      <span
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      >
        {BACKOFFICE_EMAIL_DOMAIN}
      </span>
    </div>
  )
}
