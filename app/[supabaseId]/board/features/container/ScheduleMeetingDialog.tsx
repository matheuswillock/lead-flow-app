"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Lead } from "../context/BoardTypes";
import { useParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Loader2, Share2, X } from "lucide-react";
import { useTeamContext } from "@/app/context/TeamContext";
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink";
import { useTimezone } from "@/app/context/TimezoneContext";
import {
  formatIntimezone,
  formatLocalDateValue,
  formatLocalTimeValue,
  parseDateKeyAndTimeToUtc,
} from "@/lib/dates";

export type ScheduleMeetingSuccessPayload = {
  leadId: string;
  status: Lead["status"];
  leadEmail: string | null;
  meetingDate: string | null;
  meetingTitle: string | null;
  meetingNotes: string | null;
  meetingLink: string | null;
  closerId: string | null;
  extraGuests: string[];
  meetingType: "online" | "call" | "whatsapp";
};

type ScheduleInviteDispatch = {
  status: "sent_google" | "sent_resend" | "failed";
  provider: "google" | "resend";
  fallbackUsed: boolean;
  attemptedAt: string;
  error: string | null;
};

type NoShowConfirmationPayload = {
  noShowCount: number;
  threshold: number;
};

type ScheduleShareResponse = {
  publicUrl: string;
  expiresAt: string;
};

// SCHEDULE_TIMEZONE now comes from useTimezone() inside the component

interface ScheduleMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onScheduleSuccess: (payload?: ScheduleMeetingSuccessPayload) => void | Promise<void>;
  currentProfileId?: string;
  closers: UserAssociated[];
  teamMembers?: UserAssociated[];
  mode?: "create" | "reschedule";
  initialExtraGuests?: string[];
}

export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  lead,
  onScheduleSuccess,
  closers,
  teamMembers,
  mode = "create",
  initialExtraGuests,
  currentProfileId,
}: ScheduleMeetingDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeFunctions, activeRole, isTeamMaster } = useTeamContext();
  const isCloserOperator =
    activeFunctions.includes("CLOSER") &&
    !isTeamMaster &&
    activeRole !== "manager" &&
    activeRole !== "backoffice";
  const { tz: SCHEDULE_TIMEZONE } = useTimezone();

  const [meetingDate, setMeetingDate] = useState<Date>();
  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [meetingLink, setMeetingLink] = useState<string>("");
  const [leadEmailDraft, setLeadEmailDraft] = useState<string>("");
  const [closerId, setCloserId] = useState<string>("");
  const [extraGuests, setExtraGuests] = useState<string[]>([]);
  const [meetingType, setMeetingType] = useState<"online" | "call" | "whatsapp">("online");
  const [extraGuestsDraft, setExtraGuestsDraft] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNoShowConfirmation, setPendingNoShowConfirmation] =
    useState<NoShowConfirmationPayload | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [teamMembersFromApi, setTeamMembersFromApi] = useState<UserAssociated[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [occupiedPreSlots, setOccupiedPreSlots] = useState<number[]>([]);
  const [preSlotsLoading, setPreSlotsLoading] = useState(false);
  const fallbackMembers = teamMembers && teamMembers.length > 0 ? teamMembers : closers;
  const members = teamMembersFromApi.length > 0 ? teamMembersFromApi : fallbackMembers;
  const closersFromMembers = members.filter((member) => member.functions?.includes("CLOSER"));
  const fallbackClosers = closers.filter(
    (member) => member.functions?.includes("CLOSER") || !member.functions || member.functions.length === 0
  );
  const availableClosers =
    teamMembersFromApi.length > 0
      ? closersFromMembers
      : closersFromMembers.length > 0
        ? closersFromMembers
        : fallbackClosers;
  const isValidDate = (value?: Date): value is Date =>
    value instanceof Date && !Number.isNaN(value.getTime());
  const selectedCloser = useMemo(
    () => availableClosers.find((closer) => closer.id === closerId),
    [availableClosers, closerId]
  );
  const isOnlineMeeting = meetingType === "online";
  const requiresManualMeetingLink = !!selectedCloser && !selectedCloser.googleCalendarConnected;
  const meetingLinkValidation = useMemo(
    () =>
      validateMeetingLinkValue(meetingLink, {
        required: isOnlineMeeting && requiresManualMeetingLink,
      }),
    [meetingLink, requiresManualMeetingLink, isOnlineMeeting]
  );
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPreSchedule = !!lead.isTransfer;
  const meetingDateKey = isValidDate(meetingDate) && meetingDate ? formatLocalDateValue(meetingDate, SCHEDULE_TIMEZONE) : null;
  const isPreScheduleSlotOccupied = isPreSchedule && isValidDate(meetingDate) && meetingDateKey
    ? (() => {
        const slotTime = formatLocalTimeValue(meetingDate, SCHEDULE_TIMEZONE);
        const slotDate = parseDateKeyAndTimeToUtc(meetingDateKey, slotTime, SCHEDULE_TIMEZONE);
        const utcMins = slotDate.getUTCHours() * 60 + Math.floor(slotDate.getUTCMinutes() / 30) * 30;
        return occupiedPreSlots.includes(utcMins);
      })()
    : false;
  const canSubmit = isPreSchedule
    ? isValidDate(meetingDate) && !isPreScheduleSlotOccupied
    : !!closerId &&
      (!isOnlineMeeting || isValidEmail(leadEmailDraft)) &&
      (!isOnlineMeeting || isValidDate(meetingDate)) &&
      (!isOnlineMeeting || meetingTitle.trim().length > 0) &&
      (!isOnlineMeeting || availableTimes.length > 0) &&
      (!isOnlineMeeting || meetingLinkValidation.isValid);
  const hasAvailabilityInputs = isValidDate(meetingDate) && !!closerId && !!supabaseId;

  useEffect(() => {
    if (!open || !activeTeamId || !supabaseId) {
      setTeamMembersFromApi([]);
      return;
    }

    let isMounted = true;

    const fetchTeamMembers = async () => {
      setTeamMembersLoading(true);
      try {
        const response = await fetch(`/api/v1/teams/${activeTeamId}/members`, {
          headers: {
            "x-supabase-user-id": supabaseId,
          },
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(
            Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
              ? result.errorMessages.join(", ")
              : "Erro ao carregar membros do time"
          );
        }

        const membersFromResult: UserAssociated[] = (result?.result?.members ?? []).map((member: any) => ({
          id: member.profileId,
          name: member.name || member.email || "Usuário",
          avatarImageUrl: member.profileIconUrl || "",
          email: member.email || "",
          role: member.role,
          functions: member.functions ?? [],
          googleCalendarConnected: member.googleCalendarConnected ?? false,
        }));

        if (isMounted) {
          setTeamMembersFromApi(membersFromResult);
        }
      } catch (error) {
        console.error("Erro ao carregar membros do time para agendamento:", error);
        if (isMounted) {
          setTeamMembersFromApi([]);
        }
      } finally {
        if (isMounted) {
          setTeamMembersLoading(false);
        }
      }
    };

    fetchTeamMembers();

    return () => {
      isMounted = false;
    };
  }, [open, activeTeamId, supabaseId]);

  useEffect(() => {
    if (!open) return;
    const parsedMeetingDate = lead.meetingDate ? new Date(lead.meetingDate) : undefined;
    const defaultMeetingTitle = `Estudo Plano de Saúde: ${lead.name}`;
    const hasExistingMeetingTitle = !!lead.meetingTitle?.trim();
    const shouldKeepExistingTitle = mode === "reschedule";
    setMeetingDate(isValidDate(parsedMeetingDate) ? parsedMeetingDate : undefined);
    setMeetingTitle(
      shouldKeepExistingTitle && hasExistingMeetingTitle
        ? lead.meetingTitle!
        : defaultMeetingTitle
    );
    setNotes(lead.meetingNotes || "");
    setMeetingLink(lead.meetingLink || "");
    setLeadEmailDraft(lead.email || "");
    setCloserId(lead.closerId || "");
    setExtraGuests(
      Array.isArray(initialExtraGuests)
        ? Array.from(new Set(initialExtraGuests.map((item) => item.trim().toLowerCase()).filter(Boolean)))
        : []
    );
    setMeetingType((lead.meetingType as "online" | "call" | "whatsapp" | null) ?? "online");
    setExtraGuestsDraft("");
    setPendingNoShowConfirmation(null);
  }, [open, lead, mode, initialExtraGuests]);

  useEffect(() => {
    if (!open || closerId) return;
    if (isCloserOperator && currentProfileId) {
      setCloserId(currentProfileId);
      return;
    }
    if (availableClosers.length === 1) {
      setCloserId(availableClosers[0].id);
    }
  }, [open, closerId, availableClosers, isCloserOperator, currentProfileId]);

  const toDateKey = (date: Date) => (isValidDate(date) ? formatLocalDateValue(date, SCHEDULE_TIMEZONE) : null);

  const formatTime = (date: Date) => formatLocalTimeValue(date, SCHEDULE_TIMEZONE);

  useEffect(() => {
    if (!open || !isValidDate(meetingDate) || !closerId || !supabaseId) {
      setAvailableTimes([]);
      setAvailabilityError(null);
      return;
    }

    const currentMeetingDate = meetingDate;
    const dateKey = toDateKey(currentMeetingDate);
    if (!dateKey) {
      setAvailableTimes([]);
      setAvailabilityError("Data da reunião inválida. Selecione novamente.");
      return;
    }
    let isMounted = true;

    const fetchAvailability = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      try {
        const response = await fetch("/api/v1/calendar/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify({
            closerId,
            date: dateKey,
            excludeLeadId: lead.id,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Erro ao buscar disponibilidade.");
        }

        const times = result?.result?.availableTimes ?? [];
        if (!isMounted) return;
        setAvailableTimes(times);

        const currentTime = formatTime(currentMeetingDate);
        if (times.length > 0 && !times.includes(currentTime)) {
          setMeetingDate(parseDateKeyAndTimeToUtc(dateKey, times[0], SCHEDULE_TIMEZONE));
        }
      } catch (error) {
        if (!isMounted) return;
        setAvailableTimes([]);
        setAvailabilityError(
          error instanceof Error ? error.message : "Erro ao buscar disponibilidade."
        );
      } finally {
        if (isMounted) {
          setAvailabilityLoading(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      isMounted = false;
    };
  }, [open, meetingDate, closerId, supabaseId, activeTeamId, lead.id]);

  // Fetch occupied pre-schedule slots when isPreSchedule and date changes
  useEffect(() => {
    if (!isPreSchedule || !open || !activeTeamId || !supabaseId || !meetingDateKey) {
      setOccupiedPreSlots([]);
      return;
    }
    let isMounted = true;
    setPreSlotsLoading(true);
    fetch(`/api/v1/teams/${activeTeamId}/pre-schedule-slots?date=${meetingDateKey}&excludeLeadId=${lead.id}`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId,
      },
    })
      .then((r) => r.json().catch(() => null))
      .then((result) => {
        if (!isMounted) return;
        const slots: number[] = Array.isArray(result?.result?.occupiedSlots)
          ? result.result.occupiedSlots
          : [];
        setOccupiedPreSlots(slots);
      })
      .catch(() => {
        if (isMounted) setOccupiedPreSlots([]);
      })
      .finally(() => {
        if (isMounted) setPreSlotsLoading(false);
      });
    return () => { isMounted = false; };
  }, [isPreSchedule, open, activeTeamId, supabaseId, meetingDateKey, lead.id]);

  const preScheduleAvailableTimes = useMemo(() => {
    if (!isPreSchedule || !isValidDate(meetingDate) || !meetingDateKey) return undefined;
    const allSlots: string[] = [];
    for (let mins = 7 * 60; mins <= 20 * 60; mins += 30) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      allSlots.push(`${hh}:${mm}`);
    }
    return allSlots.filter((slotTime) => {
      const slotDate = parseDateKeyAndTimeToUtc(meetingDateKey, slotTime, SCHEDULE_TIMEZONE);
      const utcMins = slotDate.getUTCHours() * 60 + Math.floor(slotDate.getUTCMinutes() / 30) * 30;
      return !occupiedPreSlots.includes(utcMins);
    });
  }, [isPreSchedule, meetingDate, meetingDateKey, occupiedPreSlots, SCHEDULE_TIMEZONE]);

  const addExtraGuests = (values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail);
    if (normalized.length === 0) return;
    setExtraGuests((prev) => Array.from(new Set([...prev, ...normalized])));
  };

  const handleExtraGuestsInput = (value: string) => {
    if (!value) {
      setExtraGuestsDraft("");
      return;
    }
    const parts = value.split(/[,;\s]+/);
    if (parts.length === 1) {
      setExtraGuestsDraft(value);
      return;
    }
    const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
    addExtraGuests(parts);
    setExtraGuestsDraft(last);
  };

  const commitExtraGuestDraft = () => {
    if (!extraGuestsDraft.trim()) return;
    handleExtraGuestsInput(`${extraGuestsDraft} `);
  };

  const requestPublicShare = useCallback(async (): Promise<ScheduleShareResponse> => {
    const response = await fetch(`/api/v1/leads/${lead.id}/schedule/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId || "",
      },
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.isValid || !result?.result?.publicUrl) {
      throw new Error(
        Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Erro ao gerar link público do agendamento."
      );
    }

    return {
      publicUrl: result.result.publicUrl as string,
      expiresAt: result.result.expiresAt as string,
    };
  }, [activeTeamId, lead.id, supabaseId]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado.");
    } catch (error) {
      console.error("Erro ao copiar link público do agendamento:", error);
      toast.error("Não foi possível copiar o link.");
    }
  }, [shareUrl]);

  const submitSchedule = useCallback(async (confirmNoShowSchedule: boolean, shouldShare = false) => {
    if ((isOnlineMeeting || isPreSchedule) && !isValidDate(meetingDate)) {
      toast.error("Selecione uma data e hora para o agendamento");
      return;
    }
    const scheduledMeetingDate = isValidDate(meetingDate) ? meetingDate : new Date();
    if ((isOnlineMeeting || isPreSchedule) && !meetingTitle.trim()) {
      toast.error("Informe o título da reunião");
      return;
    }
    if (!isPreSchedule && !closerId) {
      toast.error("Selecione um closer para a reunião");
      return;
    }
    if (!isPreSchedule && isOnlineMeeting && !isValidEmail(leadEmailDraft)) {
      toast.error("Informe um e-mail válido para agendamento online.");
      return;
    }
    if (!isPreSchedule && isOnlineMeeting && requiresManualMeetingLink && !meetingLink.trim()) {
      toast.error("Este closer não tem Google conectado. Informe um link manual da reunião.");
      return;
    }
    if (!isPreSchedule && isOnlineMeeting && !meetingLinkValidation.isValid) {
      toast.error(meetingLinkValidation.error);
      return;
    }

    const guests = extraGuests;
    const normalizedNotes = notes || `Reunião agendada com ${lead.name}`;
    const normalizedMeetingLink = meetingLinkValidation.isValid ? meetingLinkValidation.normalized : "";

    setIsSubmitting(true);
    const loadingToast = toast.loading("Agendando reunião...");

    try {
      const normalizedLeadEmail = leadEmailDraft.trim().toLowerCase();
      let resolvedLeadEmail = lead.email?.trim().toLowerCase() || null;

      if (!isPreSchedule && isOnlineMeeting && normalizedLeadEmail !== resolvedLeadEmail) {
        const updateLeadResponse = await fetch(`/api/v1/leads/${lead.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          body: JSON.stringify({
            email: normalizedLeadEmail,
          }),
        });

        const updateLeadResult = await updateLeadResponse.json().catch(() => null);
        if (!updateLeadResponse.ok || !updateLeadResult?.isValid) {
          throw new Error(updateLeadResult?.errorMessages?.join(", ") || "Erro ao atualizar e-mail do lead.");
        }

        resolvedLeadEmail = normalizedLeadEmail;
      }

      // 1. Criar agendamento
      const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          date: isOnlineMeeting || isPreSchedule ? scheduledMeetingDate.toISOString() : undefined,
          meetingTitle: isOnlineMeeting || isPreSchedule ? meetingTitle.trim() : undefined,
          notes: normalizedNotes,
          meetingLink: !isPreSchedule ? normalizedMeetingLink || undefined : undefined,
          meetingType,
          closerId: closerId || undefined,
          extraGuests: guests.length ? guests : undefined,
          transitionStatusToScheduled: !isPreSchedule,
          confirmNoShowSchedule: confirmNoShowSchedule || undefined,
        }),
      });

      const result = await response.json();
      const confirmationPayload =
        result?.result && typeof result.result === "object"
          ? (result.result as {
              requiresNoShowConfirmation?: boolean;
              noShowCount?: number;
              threshold?: number;
            })
          : null;

      if (!response.ok || !result.isValid) {
        if (confirmationPayload?.requiresNoShowConfirmation) {
          const noShowCount =
            typeof confirmationPayload.noShowCount === "number" ? confirmationPayload.noShowCount : 0;
          const threshold =
            typeof confirmationPayload.threshold === "number" ? confirmationPayload.threshold : 3;

          setPendingNoShowConfirmation({ noShowCount, threshold });
          toast.info(
            `Este lead já teve no-show ${noShowCount} vezes. Confirme para continuar com o agendamento.`,
            {
              id: loadingToast,
              duration: 5000,
            }
          );
          return;
        }

        throw new Error(result.errorMessages?.join(", ") || "Erro ao agendar reunião");
      }

      const warningMessage = Array.isArray(result?.successMessages)
        ? result.successMessages.find((message: string) => message.toLowerCase().startsWith("aviso"))
        : undefined;

      const scheduleResult = (result?.result || {}) as {
        date?: string;
        status?: Lead["status"];
        meetingTitle?: string | null;
        notes?: string | null;
        meetingLink?: string | null;
        extraGuests?: string[];
        inviteDispatch?: ScheduleInviteDispatch;
      };
      const inviteDispatch = scheduleResult.inviteDispatch;

      // ✅ Sucesso - Fechar dialog e atualizar UI
      const successMessage = isPreSchedule
        ? `Pré-agendamento salvo para ${formatIntimezone(
            scheduledMeetingDate,
            "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
            SCHEDULE_TIMEZONE,
          )}`
        : isOnlineMeeting
        ? `Reunião agendada para ${formatIntimezone(
            scheduledMeetingDate,
            "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
            SCHEDULE_TIMEZONE,
          )}`
        : meetingType === "call"
          ? "Ligação agendada com sucesso."
          : "Agendamento por WhatsApp criado com sucesso.";
      toast.success(successMessage, { id: loadingToast, duration: 4000 })

      if (inviteDispatch?.status === "failed") {
        const errorText = inviteDispatch.error
          ? `Agendamento salvo, mas o convite não foi enviado: ${inviteDispatch.error}`
          : "Agendamento salvo, mas o convite não foi enviado.";
        toast.error(errorText, { duration: 6000 });
      } else if (inviteDispatch?.status === "sent_resend" && inviteDispatch.fallbackUsed) {
        toast.info("Google falhou e o convite foi enviado via e-mail (Resend).", { duration: 5000 });
      } else if (warningMessage) {
        toast.info(warningMessage, { duration: 5000 });
      }
      const resolvedMeetingLink =
        typeof scheduleResult.meetingLink === "string"
          ? scheduleResult.meetingLink
          : meetingLink || null;
      const schedulePayload: ScheduleMeetingSuccessPayload = {
        leadId: lead.id,
        status: scheduleResult.status ?? (isPreSchedule ? lead.status : "scheduled"),
        leadEmail: resolvedLeadEmail,
        meetingDate:
          typeof scheduleResult.date === "string"
            ? scheduleResult.date
            : isOnlineMeeting || isPreSchedule
              ? scheduledMeetingDate.toISOString()
              : null,
        meetingTitle:
          typeof scheduleResult.meetingTitle === "string"
            ? scheduleResult.meetingTitle
            : isOnlineMeeting || isPreSchedule
              ? meetingTitle.trim()
              : null,
        meetingNotes:
          typeof scheduleResult.notes === "string"
            ? scheduleResult.notes
            : normalizedNotes,
        meetingLink: resolvedMeetingLink,
        closerId: isPreSchedule ? null : closerId || lead.closerId || null,
        extraGuests: Array.isArray(scheduleResult.extraGuests)
          ? scheduleResult.extraGuests
          : guests,
        meetingType,
      };
      
      if (shouldShare && meetingType === "online") {
        const shareResult = await requestPublicShare();
        setShareUrl(shareResult.publicUrl);
        setShareExpiresAt(shareResult.expiresAt);
      }

      // Limpar form
      setMeetingDate(undefined);
      setMeetingTitle("");
      setNotes("");
      setMeetingLink("");
      setMeetingType("online");
      setLeadEmailDraft(resolvedLeadEmail || "");
      setExtraGuests([]);
      setExtraGuestsDraft("");

      // 2. Atualizar estado local/board antes de fechar o dialog
      await onScheduleSuccess(schedulePayload);

      // Fechar dialog
      onOpenChange(false);
      if (shouldShare && meetingType === "online") {
        setShareDialogOpen(true);
      }
      
    } catch (error) {
      console.error("Erro ao agendar reunião:", error);
      
      // ❌ Erro - Mostrar mensagem de erro
      toast.error(error instanceof Error ? error.message : "Erro ao agendar reunião", {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [SCHEDULE_TIMEZONE, activeTeamId, closerId, lead.closerId, lead.email, lead.id, lead.name, lead.status, meetingDate, meetingLink, meetingLinkValidation, meetingTitle, meetingType, notes, onOpenChange, onScheduleSuccess, requestPublicShare, requiresManualMeetingLink, supabaseId, extraGuests, isOnlineMeeting, isPreSchedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitSchedule(false, false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {isPreSchedule
                ? mode === "reschedule"
                  ? "Editar Pré-agendamento"
                  : "Pré-agendar Lead"
                : mode === "reschedule"
                  ? "Reagendar Reunião"
                  : "Agendar Reunião"}
            </DialogTitle>
            <DialogDescription>
              {isPreSchedule
                ? mode === "reschedule"
                  ? "Editar reserva de horário de "
                  : "Reservar horário para "
                : mode === "reschedule"
                  ? "Reagendar reunião com "
                  : "Agendar reunião com "}
              <strong>{lead.name}</strong>
              {isPreSchedule && " — o lead permanece em Nova oportunidade até a transferência ser concluída."}
            </DialogDescription>
          </DialogHeader>

          <div className="scroll-hover-y min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 py-4">
            {/* Closer — oculto em pré-agendamento */}
            {!isPreSchedule && (
              <div className="grid gap-2">
                <Label>Closer</Label>
                <Select value={closerId} onValueChange={setCloserId}>
                  <SelectTrigger disabled={teamMembersLoading || isCloserOperator}>
                    <SelectValue
                      placeholder={
                        teamMembersLoading
                          ? "Carregando closers..."
                          : availableClosers.length
                            ? "Selecione um closer"
                            : "Sem closers disponíveis"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClosers.map((closer) => (
                      <SelectItem key={closer.id} value={closer.id}>
                        {closer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!teamMembersLoading && !availableClosers.length && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum closer disponível para este time.
                  </p>
                )}
                {selectedCloser && !selectedCloser.googleCalendarConnected && (
                  <p className="text-xs text-amber-600">
                    Este closer está sem Google conectado. O link da reunião deve ser informado manualmente.
                  </p>
                )}
              </div>
            )}

            {/* Data e Hora */}
            <div className="grid gap-2">
              <Label>Tipo de agendamento</Label>
              <RadioGroup
                value={meetingType}
                onValueChange={(value) => setMeetingType(value as "online" | "call" | "whatsapp")}
                className="grid gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="online" id="meeting-type-online" />
                  <Label htmlFor="meeting-type-online">Online</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="call" id="meeting-type-call" />
                  <Label htmlFor="meeting-type-call">Ligação</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="whatsapp" id="meeting-type-whatsapp" />
                  <Label htmlFor="meeting-type-whatsapp">WhatsApp</Label>
                </div>
              </RadioGroup>
            </div>

            {isOnlineMeeting && (
              <div className="grid gap-2">
                <Label htmlFor="lead-email">E-mail do lead</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="lead@exemplo.com"
                  value={leadEmailDraft}
                  onChange={(event) => setLeadEmailDraft(event.target.value)}
                  required
                />
                {!isValidEmail(leadEmailDraft) && (
                  <p className="text-xs text-muted-foreground">
                    Informe um e-mail válido para concluir o agendamento online.
                  </p>
                )}
              </div>
            )}

            <DateTimePicker
              date={meetingDate}
              onDateChange={setMeetingDate}
              label={isPreSchedule ? "Data e Horário do Pré-agendamento" : "Data e Horário da Reunião"}
              required={isOnlineMeeting || isPreSchedule}
              disabled={!isOnlineMeeting && !isPreSchedule}
              disablePastDates
              availableTimes={isPreSchedule ? (preScheduleAvailableTimes ?? []) : availableTimes}
              timeLoading={isPreSchedule ? preSlotsLoading : availabilityLoading}
              tz={SCHEDULE_TIMEZONE}
            />
            {isOnlineMeeting && !isValidDate(meetingDate) && (
              <p className="text-xs text-muted-foreground">Selecione uma data para carregar horários disponíveis.</p>
            )}
            {isOnlineMeeting && !isPreSchedule && isValidDate(meetingDate) && !closerId && (
              <p className="text-xs text-muted-foreground">Selecione um closer para carregar horários disponíveis.</p>
            )}
            {isOnlineMeeting && availabilityLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Carregando horários disponíveis...
              </p>
            )}
            {isOnlineMeeting && availabilityError && (
              <p className="text-xs text-destructive">{availabilityError}</p>
            )}
            {isOnlineMeeting && !isPreSchedule && hasAvailabilityInputs && availableTimes.length === 0 && !availabilityLoading && !availabilityError && (
              <p className="text-xs text-muted-foreground">Nenhum horário disponível para este dia.</p>
            )}

            {/* Titulo da reuniao */}
            <div className="grid gap-2">
              <Label htmlFor="meetingTitle">Titulo da reuniao</Label>
              <Input
                id="meetingTitle"
                placeholder="Ex: Apresentação da proposta"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                required={isOnlineMeeting}
                disabled={!isOnlineMeeting}
              />
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre a reunião..."
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Link da reunião — oculto em pré-agendamento */}
            {!isPreSchedule && (
              <div className="grid gap-2">
                <Label htmlFor="meetingLink">
                  Link da reunião {isOnlineMeeting && requiresManualMeetingLink ? "(obrigatório para este closer)" : ""}
                </Label>
                <Input
                  id="meetingLink"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                />
                {isOnlineMeeting && requiresManualMeetingLink && (
                  <p className="text-xs text-amber-600">
                    O closer selecionado não tem Google conectado. Informe manualmente o link da reunião para continuar.
                  </p>
                )}
                {isOnlineMeeting && meetingLink.trim() && !meetingLinkValidation.isValid && (
                  <p className="text-xs text-destructive">{meetingLinkValidation.error}</p>
                )}
              </div>
            )}

            {/* Convidados extras */}
            <div className="grid gap-2">
              <Label htmlFor="extraGuests">Convidados extras (emails)</Label>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                {extraGuests.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1 pr-1">
                    <span>{email}</span>
                    <button
                      type="button"
                      className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                      onClick={() =>
                        setExtraGuests((prev) => prev.filter((item) => item !== email))
                      }
                      aria-label={`Remover ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="extraGuests"
                  type="text"
                  value={extraGuestsDraft}
                  onChange={(e) => handleExtraGuestsInput(e.target.value)}
                  onBlur={commitExtraGuestDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitExtraGuestDraft();
                    }
                  }}
                  placeholder="ex: convidado1@email.com, convidado2@email.com"
                  className="min-w-35 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Adicionar membros do time:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      Selecionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60">
                    {members
                      .filter((member) => member.email)
                      .map((member) => {
                        const email = member.email!;
                        const checked = extraGuests.includes(email.toLowerCase());
                        return (
                          <DropdownMenuCheckboxItem
                            key={member.id}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked) {
                                addExtraGuests([email]);
                              } else {
                                setExtraGuests((prev) =>
                                  prev.filter((item) => item !== email.toLowerCase())
                                );
                              }
                            }}
                          >
                            {member.name}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-xs text-muted-foreground">
                Separe os emails por vírgula ou espaço.
              </p>
            </div>

            </div>
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            {isOnlineMeeting && !isPreSchedule && mode !== "reschedule" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void submitSchedule(false, true)}
                disabled={isSubmitting || !canSubmit}
              >
                <Share2 data-icon="inline-start" />
                {isSubmitting ? "Salvando..." : "Salvar e compartilhar"}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting
                ? "Salvando..."
                : isPreSchedule
                  ? mode === "reschedule"
                    ? "Atualizar Pré-agendamento"
                    : "Pré-agendar"
                  : mode === "reschedule"
                    ? "Reagendar Reunião"
                    : "Agendar Reunião"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <AlertDialog
        open={!!pendingNoShowConfirmation}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setPendingNoShowConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação de agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingNoShowConfirmation
                ? `Este lead já teve no-show ${pendingNoShowConfirmation.noShowCount} vezes (limite: ${pendingNoShowConfirmation.threshold}). Deseja continuar com este agendamento?`
                : "Deseja continuar com este agendamento?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                setPendingNoShowConfirmation(null);
                void submitSchedule(true, false);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Link público do agendamento</DialogTitle>
            <DialogDescription>
              Compartilhe este link para abrir o modal público da reunião.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border bg-surface-2 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Agendamento online</p>
                  <p className="text-sm font-medium text-foreground">{lead.name}</p>
                </div>
                {shareExpiresAt && (
                  <Badge variant="outline" className="border-[color:var(--semantic-info-border)] text-[color:var(--semantic-info)]">
                    Expira em {formatIntimezone(new Date(shareExpiresAt), "dd/MM/yyyy HH:mm", SCHEDULE_TIMEZONE)}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="public-share-url">Link público</Label>
              <div className="flex items-center gap-2">
                <Input id="public-share-url" value={shareUrl} readOnly />
                <Button type="button" variant="secondary" onClick={() => void handleCopyShareLink()} disabled={!shareUrl}>
                  <Copy />
                  Copiar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
