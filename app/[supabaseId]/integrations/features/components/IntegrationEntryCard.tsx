import Link from "next/link";
import { Lock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface IntegrationEntryBadge {
  label: string;
  variant?: "default" | "secondary" | "outline";
}

interface IntegrationEntryCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  state: React.ReactNode;
  badge?: IntegrationEntryBadge;
  /** Quando ausente, o card não navega (bloqueado ou "em breve"). */
  href?: string;
  /** Falta a feature: mostra cadeado e o caminho para contratar, em vez de sumir (DA3). */
  locked?: boolean;
  lockedHref?: string;
}

export function IntegrationEntryCard({
  icon: Icon,
  title,
  description,
  state,
  badge,
  href,
  locked = false,
  lockedHref,
}: IntegrationEntryCardProps) {
  const cardContent = (
    <Card
      className={cn(
        "h-full transition-colors",
        href && "hover:bg-muted/40",
        locked && "border-dashed bg-muted/20"
      )}
    >
      <CardHeader className="flex flex-row items-start gap-3">
        <div className={cn("rounded-md border bg-background p-2", locked && "text-muted-foreground")}>
          {locked ? <Lock className="size-5" /> : <Icon className="size-5 text-primary" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {locked ? (
              <Badge variant="outline">Bloqueado</Badge>
            ) : (
              badge && <Badge variant={badge.variant ?? "secondary"}>{badge.label}</Badge>
            )}
          </div>
          <CardDescription>{description}</CardDescription>
          <div className="text-sm text-muted-foreground">{state}</div>
        </div>
      </CardHeader>
    </Card>
  );

  if (locked) {
    return (
      <Link
        href={lockedHref ?? "#"}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${title}: recurso bloqueado, ver planos`}
      >
        {cardContent}
      </Link>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {cardContent}
      </Link>
    );
  }

  return <div>{cardContent}</div>;
}
