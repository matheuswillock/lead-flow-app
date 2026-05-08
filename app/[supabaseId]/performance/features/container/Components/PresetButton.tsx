import { Button } from "@/components/ui/button";

interface PresetButtonProps {
  onClick: () => void
  label: string
  active?: boolean
}

export function PresetButton({ onClick, label, active }: PresetButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={`h-8 px-3 text-xs rounded-md transition-colors num
        ${
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-[0_4px_14px_-6px_rgba(245,73,0,0.6)]"
            : "border border-border hover:bg-white/4 text-white/85"
        }`}
    >
      {label}
    </Button>
  )
}