import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgeTagsInputProps = {
  ages: number[];
  ageInput: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onAddAges: () => void;
  onRemoveAge: (index: number) => void;
  onClearAges: () => void;
};

export function AgeTagsInput({
  ages,
  ageInput,
  isLoading,
  onInputChange,
  onAddAges,
  onRemoveAge,
  onClearAges,
}: AgeTagsInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {ages.map((age, index) => (
          <span
            key={`${age}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-[color-mix(in_oklab,var(--primary)_12%,var(--card))] px-3 py-1 text-sm font-medium text-primary"
          >
            {age} anos
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full text-primary/70 transition-colors hover:text-primary"
              onClick={() => onRemoveAge(index)}
              aria-label={`Remover idade ${age}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={ageInput}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddAges();
            }
          }}
          placeholder="Ex: 36, 33, 12, 45"
          className="h-11 min-w-[280px] flex-1 bg-card"
        />
        <Button type="button" className="h-11 px-5" onClick={onAddAges} disabled={isLoading}>
          Simular
        </Button>
        <Button type="button" variant="outline" className="h-11 px-5" onClick={onClearAges} disabled={isLoading}>
          Limpar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Digite as idades separadas por virgula e pressione Enter
      </p>
    </div>
  );
}

