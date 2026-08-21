"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, MessageCircle, MessageSquare, Phone, Smile } from 'lucide-react';
import { toastUserError } from '@/lib/ui/to-user-toast-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useTeamContext } from '@/app/context/TeamContext';
import type { LeadActivityResponseDTO } from '@/app/api/v1/leads/DTO/leadResponseDTO';
import { resolveStudioActivityAuthor } from '@/lib/lead-activities/resolveActivityAuthor';
import { isStudioAuthoredPayload } from '@/lib/studio-feed-identity';
import { API_CLIENT_BASE } from "@/lib/route-map";

const ACTIVITY_TYPES = [
  { value: 'note',     label: 'Comentário', Icon: MessageSquare },
  { value: 'call',     label: 'Ligação',    Icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp',   Icon: MessageCircle },
  { value: 'email',    label: 'Email',      Icon: Mail },
] as const;

type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number]['value'];

function formatActivityDate(value: string): string {
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return value;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

interface CarteiraActivityFeedProps {
  leadId: string | null;
  open?: boolean;
}

export function CarteiraActivityFeed({ leadId, open = true }: CarteiraActivityFeedProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [activities, setActivities] = useState<LeadActivityResponseDTO[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activityType, setActivityType] = useState<ActivityTypeValue>('note');
  const [activityBody, setActivityBody] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    setActivitiesLoading(true);
    fetch(`${API_CLIENT_BASE}/leads/${leadId}/details`, {
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': activeTeamId ?? '',
      },
    })
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        const acts: LeadActivityResponseDTO[] = result?.result?.lead?.activities ?? [];
        setActivities(acts);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setActivitiesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, leadId, supabaseId, activeTeamId]);

  const handleSubmit = async () => {
    const trimmed = activityBody.trim();
    if (!trimmed || activitySubmitting || !leadId) return;
    setActivitySubmitting(true);
    try {
      const res = await fetch(`${API_CLIENT_BASE}/leads/${leadId}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-user-id': supabaseId,
          'x-team-id': activeTeamId ?? '',
        },
        body: JSON.stringify({ type: activityType, body: trimmed, mentions: [] }),
      });
      const result = await res.json();
      if (!res.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] ?? 'Erro ao registrar atividade');
      }
      const newActivity: LeadActivityResponseDTO = result.result?.activity ?? {
        id: `optimistic-${Date.now()}`,
        type: activityType,
        body: trimmed,
        payload: null,
        createdAt: new Date().toISOString(),
        reactions: [],
        author: null,
      };
      setActivities((prev) => [newActivity, ...prev]);
      setActivityBody('');
    } catch (error) {
      toastUserError(error);
    } finally {
      setActivitySubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">Feed de Atividades</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Registro de criação, comentários e mudanças importantes.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activitiesLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhuma atividade registrada.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activities.map((activity) => {
              const author =
                activity.author ??
                (isStudioAuthoredPayload(activity.payload)
                  ? resolveStudioActivityAuthor(
                      activity.payload as Record<string, unknown> | null | undefined
                    )
                  : null);
              const authorName = author?.fullName ?? author?.email ?? 'Sistema';
              const avatarSrc =
                author?.avatarUrl ??
                (author?.email
                  ? `https://avatar.vercel.sh/${author.email}.png`
                  : '/corretor-studio-icon.svg');
              const initials = getInitials(authorName);
              const TypeIcon = ACTIVITY_TYPES.find((t) => t.value === activity.type)?.Icon ?? MessageSquare;
              return (
                <div key={activity.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3">
                    <Avatar className="size-6 rounded-lg border border-border/60">
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback className="rounded-lg text-[10px]">{initials || 'LF'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{authorName}</span>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TypeIcon className="size-3" />
                          <span className="text-[10px]">{formatActivityDate(activity.createdAt)}</span>
                        </div>
                      </div>
                      {activity.body && <p className="text-sm">{activity.body}</p>}
                      <Button variant="ghost" size="sm" className="mt-1 h-6 w-fit gap-1 px-1.5 text-xs text-muted-foreground">
                        <Smile className="size-3" /> Reagir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityTypeValue)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map(({ value, label, Icon }) => (
              <SelectItem key={value} value={value}>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={activityBody}
          onChange={(e) => setActivityBody(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="resize-none text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!activityBody.trim() || activitySubmitting}
            onClick={handleSubmit}
          >
            {activitySubmitting ? 'Registrando...' : '+ Registrar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
