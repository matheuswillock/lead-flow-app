import { ArrowDown, ArrowUp } from "lucide-react";

interface DeltaProps {
  value: number
  inverse?: boolean
}

export function Delta({ value, inverse = false }: DeltaProps) {
  const positive = value >= 0
  // For metrics like no-show, "negative" is good
  const isGood = inverse ? !positive : positive
  const Icon = positive ? ArrowUp : ArrowDown
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold num ${isGood ? "text-(--success)" : "text-(--danger)"}`}
    >
      <Icon size={11} strokeWidth={2.5} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}
