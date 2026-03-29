import { cn } from "@/lib/utils";

function ConnectingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

export { ConnectingDots };
