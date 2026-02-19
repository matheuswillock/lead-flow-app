import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { leadFormData } from "@/lib/validations/validationForms";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLead, useLeads } from "@/hooks/useLeads";
import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "@/app/api/v1/leads/DTO/requestToUpdateLead";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, Mail, MessageCircle, MessageSquare, Phone, Smile, X } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { FinalizeContractDialog, FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes";
import type { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import type { LeadActivityReactionSummary, LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { useParams, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { EmojiStyle, Theme } from "emoji-picker-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamContext } from "@/app/context/TeamContext";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { COLUMNS } from "@/app/[supabaseId]/board/features/context/BoardContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { replaceShortcodes } from "@/lib/emojiShortcodes";

interface LeadDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  lead: Lead | null;
  user: ProfileResponseDTO | null;
  userLoading: boolean;
  refreshLeads: () => Promise<void>;
  patchLead?: (leadId: string, patch: Partial<Lead>) => void;
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
}

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((mod) => mod.default), {
  ssr: false,
});

type EmojiPickerData = {
  emoji: string;
  unified: string;
};

const DEFAULT_REACTION_UNIFIEDS = ["1f44d", "2764-fe0f", "1f602", "1f389", "1f62e", "1f622"];

export default function LeadDialog({
  open,
  setOpen,
  lead,
  user,
  userLoading,
  refreshLeads,
  patchLead,
  finalizeContract,
}: LeadDialogProps) {
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const { lead: leadDetails, loading: leadDetailsLoading, error: leadDetailsError, fetchLead } = useLead(lead?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingHealdSaving, setMeetingHealdSaving] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizeCompleted, setFinalizeCompleted] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<"all" | "single" | "new">("all");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [newParticipantDraft, setNewParticipantDraft] = useState("");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [scheduleGuests, setScheduleGuests] = useState<string[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [activityType, setActivityType] = useState<"note" | "call" | "whatsapp" | "email">("note");
  const [activityBody, setActivityBody] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [optimisticActivities, setOptimisticActivities] = useState<LeadActivityResponseDTO[]>([]);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, LeadActivityReactionSummary[]>>({});
  const [reactionPickerOpenId, setReactionPickerOpenId] = useState<string | null>(null);
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusSelection, setStatusSelection] = useState<string>("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const activityInputRef = useRef<HTMLTextAreaElement | null>(null);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId, activeFunctions, isTeamMaster } = useTeamContext();
  const pathname = usePathname();
  const currentActivitiesLead = leadDetails?.id === lead?.id ? leadDetails : null;
  const isActivityLoading = leadDetailsLoading || (!!lead && leadDetails?.id !== lead.id);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (lead?.id && open) {
      fetchLead();
    }
  }, [lead?.id, open, fetchLead]);

  useEffect(() => {
    if (!open) {
      setActivityBody("");
      setActivityType("note");
      setOptimisticActivities([]);
      setReactionOverrides({});
      setReactionPickerOpenId(null);
      setCommentEmojiOpen(false);
    }
  }, [open]);

  useEffect(() => {
    setOptimisticActivities([]);
    setReactionOverrides({});
    setReactionPickerOpenId(null);
  }, [lead?.id]);

  useEffect(() => {
    if (lead?.status) {
      setStatusSelection(lead.status);
    }
  }, [lead?.status]);

  const shareUrl = useMemo(() => {
    if (!lead || !origin || !lead.leadCode) return "";
    const isPipeline = pathname.includes("/pipeline");
    const basePath = isPipeline ? "/pipeline" : "/board";
    const url = new URL(basePath, origin);
    url.searchParams.set("leadCode", lead.leadCode);
    return url.toString();
  }, [lead, origin, pathname]);

  const shareMessage = useMemo(() => {
    if (!lead) return shareUrl;
    return `Lead: ${lead.name}\n${shareUrl}`;
  }, [lead, shareUrl]);

  const whatsappShare = useMemo(() => {
    if (!shareUrl) return "#";
    return `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, shareUrl]);

  const messengerShare = useMemo(() => {
    if (!shareUrl) return "#";
    return `https://www.messenger.com/share?link=${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  const emailShare = useMemo(() => {
    if (!shareUrl) return "#";
    const subject = encodeURIComponent("Lead compartilhado");
    return `mailto:?subject=${subject}&body=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, shareUrl]);

  const canFinalizeContract = lead && (
    lead.status === "invoicePayment" ||
    lead.status === "dps_agreement" ||
    lead.status === "offerSubmission"
  );
  const canMarkNoShow = lead?.status === "scheduled";
  const shouldShowMeetingHeald = !!lead && lead.status === "scheduled";
  const canEditMeetingHeald =
    shouldShowMeetingHeald && (isTeamMaster || activeFunctions.includes("CLOSER"));
  const showMeetingLink = !!lead && lead.status !== "new_opportunity";
  const canReactToActivity =
    !!user && (user.role === "manager" || activeFunctions.includes("SDR") || activeFunctions.includes("CLOSER"));
  const statusLabel = lead
    ? COLUMNS.find((column) => column.key === lead.status)?.title || lead.status
    : "Status";

  const buildParticipantOptions = () => {
    const options: { label: string; email: string }[] = [];
    if (lead?.email) {
      options.push({ label: `${lead.name} (Lead)`, email: lead.email });
    }
    if (lead?.closer?.email) {
      options.push({
        label: `${lead.closer.fullName || lead.closer.email} (Closer)`,
        email: lead.closer.email,
      });
    }
    if (user?.email) {
      options.push({
        label: `${user.fullName || user.email} (Master)`,
        email: user.email,
      });
    }
    scheduleGuests.forEach((guestEmail) => {
      if (!options.some((option) => option.email === guestEmail)) {
        options.push({ label: guestEmail, email: guestEmail });
      }
    });
    const seen = new Set<string>();
    return options.filter((option) => {
      const normalized = option.email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  };

  const handleCopyLeadCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("ID copiado");
    } catch (error) {
      console.error("Erro ao copiar ID do lead:", error);
      toast.error("Nao foi possivel copiar o ID");
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link de compartilhamento copiado");
    } catch (error) {
      console.error("Erro ao copiar link de compartilhamento:", error);
      toast.error("Nao foi possivel copiar o link");
    }
  };

  const handleAddActivity = async () => {
    if (!lead?.id || !supabaseId) return;
    const trimmed = activityBody.trim();
    if (!trimmed) {
      toast.error("Informe uma mensagem para registrar a atividade");
      return;
    }
    setActivitySubmitting(true);
    let normalizedBody = trimmed;
    try {
      normalizedBody = await replaceShortcodes(trimmed);
    } catch (error) {
      console.warn("Falha ao converter shortcodes de emoji:", error);
    }
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          type: activityType,
          body: normalizedBody,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        const message = Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Erro ao adicionar atividade";
        throw new Error(message);
      }
      const createdActivity = result?.result as LeadActivityResponseDTO | undefined;
      if (createdActivity) {
        const normalizedActivity: LeadActivityResponseDTO = {
          ...createdActivity,
          reactions: createdActivity.reactions ?? [],
          author: createdActivity.author
            ? {
                ...createdActivity.author,
                avatarUrl:
                  createdActivity.author.avatarUrl ??
                  (createdActivity.author as { profileIconUrl?: string | null }).profileIconUrl ??
                  null,
              }
            : null,
        };
        setOptimisticActivities((prev) => {
          const existing = prev.find((activity) => activity.id === normalizedActivity.id);
          if (existing) {
            return prev.map((activity) =>
              activity.id === normalizedActivity.id ? normalizedActivity : activity
            );
          }
          return [normalizedActivity, ...prev];
        });
      }
      setActivityBody("");
      toast.success("Atividade registrada");
      fetchLead();
    } catch (error) {
      console.error("Erro ao adicionar atividade:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar atividade");
    } finally {
      setActivitySubmitting(false);
    }
  };

  const formatActivityDate = (value: string) => {
    try {
      const date = new Date(value);
      return date.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(" ").filter(Boolean);
    if (words.length === 0) return "LF";
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const activityTypeOptions = [
    { value: "note", label: "Comentário", icon: <MessageSquare className="h-4 w-4 text-primary" /> },
    { value: "call", label: "Ligação", icon: <Phone className="h-4 w-4 text-primary" /> },
    { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4 text-primary" /> },
    { value: "email", label: "Email", icon: <Mail className="h-4 w-4 text-primary" /> },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4 text-primary" />;
      case "whatsapp":
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case "email":
        return <Mail className="h-4 w-4 text-primary" />;
      case "status_change":
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case "note":
      default:
        return <MessageSquare className="h-4 w-4 text-primary" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "call":
        return "Ligação";
      case "whatsapp":
        return "WhatsApp";
      case "email":
        return "Email";
      case "status_change":
        return "Status";
      case "note":
      default:
        return "Comentário";
    }
  };

  const isScheduleActivity = (activity: LeadActivityResponseDTO) => {
    if (activity?.payload && typeof activity.payload === "object") {
      const payload = activity.payload as { kind?: string };
      if (payload.kind === "schedule") return true;
    }
    return (
      activity.body?.startsWith("Agendamento") ||
      activity.body?.startsWith("Reagendamento") ||
      false
    );
  };

  const mergedActivities = useMemo(() => {
    const serverActivities = currentActivitiesLead?.activities || [];
    const map = new Map<string, LeadActivityResponseDTO>();
    optimisticActivities.forEach((activity) => {
      map.set(activity.id, activity);
    });
    serverActivities.forEach((activity) => {
      map.set(activity.id, activity);
    });
    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [optimisticActivities, currentActivitiesLead?.activities]);

  const getReactionsForActivity = (activityId: string) => {
    const override = reactionOverrides[activityId];
    if (override) return override;
    const activity = mergedActivities.find((item) => item.id === activityId);
    return activity?.reactions ?? [];
  };

  const buildOptimisticReactions = (
    current: LeadActivityReactionSummary[],
    emoji: string,
    unified: string
  ) => {
    const existing = current.find((reaction) => reaction.unified === unified);
    if (!existing) {
      return [...current, { emoji, unified, count: 1, reactedByMe: true }];
    }

    if (existing.reactedByMe) {
      if (existing.count <= 1) {
        return current.filter((reaction) => reaction.unified !== unified);
      }
      return current.map((reaction) =>
        reaction.unified === unified
          ? { ...reaction, count: reaction.count - 1, reactedByMe: false }
          : reaction
      );
    }

    return current.map((reaction) =>
      reaction.unified === unified
        ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
        : reaction
    );
  };

  const handleToggleReaction = async (activityId: string, emoji: string, unified: string) => {
    if (!lead?.id || !supabaseId || !activeTeamId) return;
    if (!canReactToActivity) return;

    const previous = getReactionsForActivity(activityId);
    const optimistic = buildOptimisticReactions(previous, emoji, unified);
    setReactionOverrides((prev) => ({ ...prev, [activityId]: optimistic }));

    try {
      const response = await fetch(
        `/api/v1/leads/${lead.id}/activities/${activityId}/reactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({ emoji, unified }),
        }
      );
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        const message = Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Erro ao reagir à atividade";
        throw new Error(message);
      }

      const reactions = result?.result?.reactions as LeadActivityReactionSummary[] | undefined;
      setReactionOverrides((prev) => ({ ...prev, [activityId]: reactions ?? [] }));
    } catch (error) {
      setReactionOverrides((prev) => ({ ...prev, [activityId]: previous }));
      toast.error(error instanceof Error ? error.message : "Erro ao reagir à atividade");
    }
  };

  const insertEmojiAtCursor = (emoji: string) => {
    setActivityBody((current) => {
      const target = activityInputRef.current;
      if (!target) {
        return current + emoji;
      }
      const start = target.selectionStart ?? current.length;
      const end = target.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
      const cursor = start + emoji.length;
      requestAnimationFrame(() => {
        target.focus();
        target.setSelectionRange(cursor, cursor);
      });
      return next;
    });
  };

  const handleActivityKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!activityBody.trim() || activitySubmitting) return;
    handleAddActivity();
  };

  const parseCurrentValue = (value: string): number | undefined => {
    if (!value || value.trim() === "") return undefined;

    let cleanValue = value.replace(/[^\d.,]/g, "");

    if (cleanValue.includes(",")) {
      cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
    } else if ((cleanValue.match(/\./g) || []).length > 1) {
      const parts = cleanValue.split(".");
      const lastPart = parts.pop();
      cleanValue = parts.join("") + "." + lastPart;
    }

    const parsed = parseFloat(cleanValue);

    if (isNaN(parsed) || parsed < 0) return undefined;

    return parsed;
  };

  const parseMeetingDate = (date: string): string | undefined => {
    if (!date || date.trim() === "") return undefined;
    try {
      if (date.includes("T") && date.includes("Z")) {
        return date;
      }
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return undefined;
      }
      return parsedDate.toISOString();
    } catch {
      return undefined;
    }
  };

  const transformToCreateRequest = (data: leadFormData): CreateLeadRequest => {
    return {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      age: data.age || undefined,
      currentHealthPlan: data.currentHealthPlan || undefined,
      currentValue: parseCurrentValue(data.currentValue),
      referenceHospital: data.referenceHospital || undefined,
      currentTreatment: data.ongoingTreatment || undefined,
      notes: data.additionalNotes || undefined,
      meetingDate: parseMeetingDate(data.meetingDate || ""),
      meetingTitle: data.meetingTitle || undefined,
      meetingNotes: data.meetingNotes || undefined,
      meetingLink: data.meetingLink || undefined,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      closerId: data.closerId || undefined,
      status: "new_opportunity" as any,
      ticket: undefined,
      contractDueDate: undefined,
      soldPlan: undefined,
    };
  };

  const transformToUpdateRequest = (data: leadFormData): UpdateLeadRequest => {
    return {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      age: data.age || undefined,
      currentHealthPlan: data.currentHealthPlan || undefined,
      currentValue: parseCurrentValue(data.currentValue),
      referenceHospital: data.referenceHospital || undefined,
      currentTreatment: data.ongoingTreatment || undefined,
      notes: data.additionalNotes || undefined,
      meetingDate: parseMeetingDate(data.meetingDate || ""),
      meetingTitle: data.meetingTitle || undefined,
      meetingNotes: data.meetingNotes || undefined,
      meetingLink: data.meetingLink || undefined,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      closerId: data.closerId || undefined,
      ticket: data.ticket ? parseCurrentValue(data.ticket) : undefined,
      contractDueDate: parseMeetingDate(data.contractDueDate || ""),
      soldPlan: data.soldPlan || undefined,
    };
  };

  const handleMeetingHealdChange = async (next: "yes" | "no") => {
    if (!lead || !supabaseId || !activeTeamId) return;
    if (lead.status !== "scheduled") return;
    if (!canEditMeetingHeald) return;

    const previous = (lead.meetingHeald ?? "no") as "yes" | "no";

    // Optimistic UI update (board/pipeline selected lead + lists).
    patchLead?.(lead.id, { meetingHeald: next });
    setMeetingHealdSaving(true);

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
        body: JSON.stringify({ meetingHeald: next }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel atualizar a reuniao.");
      }

      // Keep local state aligned with server response.
      const serverValue = (result?.result?.meetingHeald ?? next) as "yes" | "no";
      patchLead?.(lead.id, { meetingHeald: serverValue });
      form.setValue("meetingHeald", serverValue, { shouldDirty: false });
    } catch (error) {
      patchLead?.(lead.id, { meetingHeald: previous });
      form.setValue("meetingHeald", previous, { shouldDirty: false });
      toast.warning(error instanceof Error ? error.message : "Nao foi possivel atualizar a reuniao.");
    } finally {
      setMeetingHealdSaving(false);
    }
  };

  const onSubmit = async (data: leadFormData) => {
    setIsSubmitting(true);

    try {
      if (lead) {
        const loadingToast = toast.loading("Atualizando lead...");

        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(lead.id, updateData);

        if (result.success) {
          const extraGuests = parseExtraGuests(data.extraGuests);
          const normalizedGuests = Array.from(
            new Set(extraGuests.map((email) => email.toLowerCase()))
          );
          const currentGuests = Array.from(
            new Set(scheduleGuests.map((email) => email.toLowerCase()))
          );
          const guestsChanged =
            normalizedGuests.length !== currentGuests.length ||
            normalizedGuests.some((email) => !currentGuests.includes(email));

          const meetingDateValue = data.meetingDate || lead.meetingDate;
          if (meetingDateValue && (guestsChanged || data.meetingDate || data.meetingLink || data.meetingNotes)) {
            try {
              await fetch(`/api/v1/leads/${lead.id}/schedule`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-supabase-user-id": supabaseId || "",
                  "x-team-id": activeTeamId || "",
                },
                body: JSON.stringify({
                  date: meetingDateValue,
                  meetingTitle: data.meetingTitle || undefined,
                  notes: data.meetingNotes || undefined,
                  meetingLink: data.meetingLink || undefined,
                  closerId: data.closerId || undefined,
                  extraGuests: normalizedGuests,
                }),
              });
              setScheduleGuests(normalizedGuests);
            } catch (error) {
              console.error("Erro ao atualizar convidados extras:", error);
            }
          }

          toast.success(`Lead "${data.name}" atualizado com sucesso!`, {
            id: loadingToast,
            duration: 3000,
          });
          setOpen(false);
          await refreshLeads();
        } else {
          toast.error(result.message || "Erro ao atualizar lead", {
            id: loadingToast,
            duration: 5000,
          });
        }
      } else {
        const loadingToast = toast.loading(`Criando lead "${data.name}"...`);

        setOpen(false);

        try {
          const createData = transformToCreateRequest(data);
          const result = await createLead(createData);

          if (result.success) {
            toast.success(`Lead "${data.name}" criado com sucesso!`, {
              id: loadingToast,
              duration: 4000,
            });
            await refreshLeads();
          } else {
            toast.error(result.message || "Erro ao criar lead", {
              id: loadingToast,
              duration: 5000,
            });
            setOpen(true);
          }
        } catch (createError) {
          const errorMessage = createError instanceof Error ? createError.message : "Erro ao criar lead";
          const normalizedMessage = errorMessage
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

          if (errorMessage.includes("Unique constraint") || normalizedMessage.includes("ja existe")) {
            toast.error(`Aviso: ja existe um lead com este telefone: ${data.phone}`, {
              id: loadingToast,
              duration: 6000,
            });
          } else if (normalizedMessage.includes("validation") || normalizedMessage.includes("invalido")) {
            toast.error(`Aviso: dados invalidos: ${errorMessage}`, {
              id: loadingToast,
              duration: 5000,
            });
          } else {
            toast.error(errorMessage, {
              id: loadingToast,
              duration: 5000,
            });
          }

          setOpen(true);
        }
      }
    } catch (error) {
      console.error("Erro na submissao do formulario:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado ao processar o formulario";
      toast.error(errorMessage, {
        duration: 5000,
      });

      if (!lead) {
        setOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeSubmit = async (data: FinalizeContractData) => {
    if (!lead) return;

    try {
      await finalizeContract(lead.id, data);
      toast.success("Contrato finalizado com sucesso!");
      setFinalizeCompleted(true);
      setShowFinalizeDialog(false);
      setOpen(false);
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao finalizar contrato");
      throw error;
    }
  };

  const handleNoShow = async () => {
    if (!lead) return;
    if (!supabaseId) {
      toast.error("Usuario nao identificado");
      return;
    }

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({ status: "no_show" }),
      });

      if (!response.ok) {
        throw new Error("Erro ao marcar no-show");
      }

      toast.success("Lead marcado como no-show");
      setOpen(false);
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar no-show");
    }
  };

  const handleStatusUpdate = async () => {
    if (!lead || !supabaseId) return;
    const nextStatus = statusSelection || lead.status;
    if (!nextStatus || nextStatus === lead.status) {
      setStatusDialogOpen(false);
      return;
    }
    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao atualizar status");
      }
      patchLead?.(lead.id, { status: nextStatus as Lead["status"] });
      toast.success("Status atualizado");
      setStatusDialogOpen(false);
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar status");
    } finally {
      setStatusUpdating(false);
    }
  };

  useEffect(() => {
    if (lead && open) {
      const formatCurrency = (value: number): string => {
        if (value === null || value === undefined) return "";
        return `R$ ${value.toFixed(2).replace(".", ",")}`;
      };

      const formatPhone = (phone: string): string => {
        if (!phone) return "";
        const numbers = phone.replace(/\D/g, "");
        if (numbers.length === 11) {
          return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        }
        return phone;
      };

      const formatCNPJ = (cnpj: string): string => {
        if (!cnpj) return "";
        const numbers = cnpj.replace(/\D/g, "");
        if (numbers.length === 14) {
          return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }
        return cnpj;
      };

      form.reset({
        name: lead.name || "",
        phone: formatPhone(lead.phone || ""),
        email: lead.email || "",
        cnpj: formatCNPJ(lead.cnpj || ""),
        closerId: lead.closerId || "",
        age: lead.age || "",
        currentHealthPlan: lead.currentHealthPlan || undefined,
        currentValue: lead.currentValue ? formatCurrency(lead.currentValue) : "",
        referenceHospital: lead.referenceHospital || "",
        ongoingTreatment: lead.currentTreatment || "",
        additionalNotes: lead.notes || "",
        meetingDate: lead.meetingDate || "",
        meetingTitle: lead.meetingTitle || "",
        meetingNotes: lead.meetingNotes || "",
        meetingLink: lead.meetingLink || "",
        meetingHeald: lead.meetingHeald === "yes" ? "yes" : "no",
        extraGuests: scheduleGuests.join(", "),
        responsible: lead.assignedTo || "",
        ticket: lead.ticket ? formatCurrency(lead.ticket) : "",
        contractDueDate: lead.contractDueDate || "",
        soldPlan: lead.soldPlan || undefined,
      });
    } else if (!lead && open) {
      form.reset({
        name: "",
        phone: "",
        email: "",
        cnpj: "",
        closerId: "",
        age: "",
        currentHealthPlan: undefined,
        currentValue: "",
        referenceHospital: "",
        ongoingTreatment: "",
        additionalNotes: "",
        meetingDate: "",
        meetingTitle: "",
        meetingNotes: "",
        meetingLink: "",
        meetingHeald: "no",
        extraGuests: "",
        responsible: user?.usersAssociated?.[0]?.id || "",
        ticket: "",
        contractDueDate: "",
        soldPlan: undefined,
      });
    }
  }, [lead, open, form, user, scheduleGuests]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchScheduleGuests = async () => {
      if (!lead || !open) {
        setScheduleGuests([]);
        return;
      }
      if (!supabaseId) return;
      if (!lead.id) {
        setScheduleGuests([]);
        return;
      }
      if (!lead.meetingDate && !lead.meetingTitle && !lead.meetingLink) {
        setScheduleGuests([]);
        return;
      }
      if (isActive) {
        setScheduleLoading(true);
      }
      try {
        const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId || "",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          if (isActive) {
            setScheduleGuests([]);
          }
          return;
        }
        const data = await response.json().catch(() => null);
        const schedules = (data?.result || []) as Array<{
          extraGuests?: string[];
        }>;
        const latest = schedules[0];
        if (isActive) {
          setScheduleGuests(latest?.extraGuests || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (isActive) {
          setScheduleGuests([]);
        }
        console.warn("Falha ao carregar convidados extras:", error);
      } finally {
        if (isActive) {
          setScheduleLoading(false);
        }
      }
    };

    fetchScheduleGuests();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [lead, open, supabaseId, activeTeamId]);

  const handleResendInvite = async () => {
    if (!lead || !supabaseId) return;
    if (resendTarget === "single" && !resendEmail) {
      toast.error("Selecione um participante para reenviar o convite");
      return;
    }
    if (resendTarget === "new" && newParticipants.length === 0) {
      toast.error("Informe pelo menos um participante");
      return;
    }

    const loadingToast = toast.loading("Reenviando convite...");
    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/schedule/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          target: resendTarget,
          email: resendTarget === "single" ? resendEmail : undefined,
          emails: resendTarget === "new" ? newParticipants : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao reenviar convite");
      }

      const warningMessage = Array.isArray(result?.successMessages)
        ? result.successMessages.find((message: string) => message.toLowerCase().startsWith("aviso"))
        : undefined;
      const successMessage =
        Array.isArray(result?.successMessages) && result.successMessages.length > 0
          ? result.successMessages[0]
          : "Convite reenviado com sucesso!";

      const toastHandler = warningMessage && successMessage.toLowerCase().includes("não reenviados")
        ? toast.info
        : toast.success;

      toastHandler(successMessage, {
        id: loadingToast,
        duration: 3000,
      });
      if (warningMessage) {
        toast.info(warningMessage, { duration: 5000 });
      }
      setResendDialogOpen(false);
      setNewParticipants([]);
      setNewParticipantDraft("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao reenviar convite";
      toast.error(message, { id: loadingToast });
    }
  };

  const parseExtraGuests = (value: string | undefined): string[] => {
    if (!value) return [];
    return value
      .split(/[,;\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const addNewParticipants = (values: string[]) => {
    const normalized = values
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter(isValidEmail);
    if (normalized.length === 0) return;
    setNewParticipants((prev) => Array.from(new Set([...prev, ...normalized])));
  };

  const handleNewParticipantInput = (value: string) => {
    if (!value) {
      setNewParticipantDraft("");
      return;
    }
    const parts = value.split(/[,;\s]+/);
    if (parts.length === 1) {
      setNewParticipantDraft(value);
      return;
    }
    const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
    addNewParticipants(parts);
    setNewParticipantDraft(last);
  };

  const commitNewParticipantDraft = () => {
    if (!newParticipantDraft.trim()) return;
    handleNewParticipantInput(`${newParticipantDraft} `);
  };

  return (
    <>
      <Dialog open={open && !showFinalizeDialog} onOpenChange={setOpen}>
        <DialogContent
          className="bg-transparent border-none shadow-none p-0 w-[95vw] max-w-[95vw] sm:w-[90vw] sm:max-w-[90vw] lg:w-[60vw] lg:max-w-[60vw] max-h-[90vh] flex items-center justify-center [&>button]:hidden"
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
        >
          <div className="w-full max-w-full h-[90vh] max-h-[90vh] flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm flex flex-col h-full min-h-0 lg:flex-[0_0_80%] lg:h-[95%] lg:max-h-[95%] lg:self-center dialog-scrollbar overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>
                      {lead ? "Editar Lead" : "Novo Lead"}
                    </DialogTitle>
                    <DialogDescription>
                      {lead
                        ? "Faça as alterações necessárias nos dados do lead."
                        : "Preencha os dados para criar um novo lead."
                      }
                    </DialogDescription>
                    {lead?.leadCode && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>ID: {lead.leadCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyLeadCode(lead.leadCode)}
                          className="rounded-md p-1 transition-colors hover:bg-accent/60"
                          aria-label="Copiar ID do lead"
                        >
                          <CopyIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatusDialogOpen(true)}
                      disabled={!lead}
                    >
                      {statusLabel}
                    </Button>
                    {canMarkNoShow && (
                      <Button size="sm" variant="outline" onClick={handleNoShow}>
                        Marcar No-show
                      </Button>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setShareOpen(true)}
                            disabled={!lead}
                            className="h-9 w-9"
                            aria-label="Compartilhar lead"
                          >
                            <ExternalLink className="h-5 w-5" animateOnHover />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Compartilhar lead</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {canFinalizeContract && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setFinalizeCompleted(false);
                          setShowFinalizeDialog(true);
                          setOpen(false);
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Fechar Contrato
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 flex-1 min-h-0">
                {userLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Carregando dados do usuário...</p>
                    </div>
                  </div>
                ) : !user ? (
                  <div className="flex items-center justify-center p-8">
                    <p className="text-sm text-destructive">Erro ao carregar dados do usuário</p>
                  </div>
                ) : (
                  <LeadForm
                    form={form}
                    onSubmit={onSubmit}
                    isLoading={isSubmitting}
                    onCancel={() => setOpen(false)}
                    usersToAssign={user.usersAssociated || []}
                    leadId={lead?.id}
                    showMeetingHeald={shouldShowMeetingHeald}
                    meetingHealdReadOnly={shouldShowMeetingHeald && !canEditMeetingHeald}
                    meetingHealdSaving={meetingHealdSaving}
                    onMeetingHealdChange={canEditMeetingHeald ? handleMeetingHealdChange : undefined}
                    showMeetingLink={showMeetingLink}
                  />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm flex flex-col min-h-0 lg:flex-[0_0_24%] lg:h-[95%] lg:max-h-[95%] lg:self-center">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Feed de Atividades</h3>
                <DialogClose asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Registro de criação, comentários e mudanças importantes.
              </p>

              <div className="mt-4 flex-1 min-h-0 w-full">
                {!lead ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    Atividades disponíveis após criar o lead.
                  </div>
                ) : leadDetailsError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {leadDetailsError}
                  </div>
                ) : isActivityLoading ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="activity-scrollbar h-full min-h-0 overflow-y-auto pr-2">
                    <div className="space-y-3">
                      {mergedActivities.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground w-full">
                          Nenhuma atividade registrada.
                        </div>
                      ) : (
                        mergedActivities.map((activity) => {
                          const authorName =
                            activity.author?.fullName ||
                            activity.author?.email ||
                            "Sistema";
                          const initials = getInitials(authorName);
                          const fallbackEmail = activity.author?.email || "guest";
                          const avatarSrc = activity.author?.avatarUrl || `https://avatar.vercel.sh/${fallbackEmail}.png`;
                          const activityIcon = isScheduleActivity(activity)
                            ? <Calendar className="h-4 w-4 text-primary" />
                            : getActivityIcon(activity.type);
                          const reactions = getReactionsForActivity(activity.id);
                          return (
                            <div
                              key={activity.id}
                              className="rounded-lg border border-border/60 bg-background/60 p-3 w-[308px] max-w-full mr-auto"
                            >
                              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center-safe">
                                <Avatar className="h-6 w-6 rounded-lg border border-border/60">
                                  <AvatarImage src={avatarSrc} />
                                  <AvatarFallback className="rounded-lg text-[10px]">
                                    {initials || "LF"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {authorName}
                                  </span>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{formatActivityDate(activity.createdAt)}</span>
                                    <span className="inline-flex items-center">
                                      {activityIcon}
                                      <span className="sr-only">{getActivityLabel(activity.type)}</span>
                                    </span>
                                  </div>
                                </div>
                                {activity.body && (
                                  <p className="col-span-2 text-sm text-muted-foreground whitespace-pre-line break-words">
                                    {activity.body}
                                  </p>
                                )}
                                {(reactions.length > 0 || canReactToActivity) && (
                                  <div className="col-span-2 flex flex-wrap items-center gap-2">
                                    {reactions.map((reaction) => (
                                      <button
                                        key={`${activity.id}-${reaction.unified}`}
                                        type="button"
                                        className={cn(
                                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
                                          reaction.reactedByMe
                                            ? "border-primary/40 bg-primary/15 text-primary"
                                            : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
                                        )}
                                        onClick={() =>
                                          handleToggleReaction(activity.id, reaction.emoji, reaction.unified)
                                        }
                                        disabled={!canReactToActivity}
                                      >
                                        <span>{reaction.emoji}</span>
                                        <span>{reaction.count}</span>
                                      </button>
                                    ))}
                                    {canReactToActivity && (
                                      <Popover
                                        open={reactionPickerOpenId === activity.id}
                                        onOpenChange={(open) =>
                                          setReactionPickerOpenId(open ? activity.id : null)
                                        }
                                      >
                                        <PopoverTrigger asChild>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[11px]"
                                          >
                                            <Smile className="mr-1 h-3.5 w-3.5" />
                                            Reagir
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="top">
                                          <EmojiPicker
                                            onEmojiClick={(emojiData: EmojiPickerData) => {
                                              if (!emojiData?.emoji || !emojiData?.unified) return;
                                              handleToggleReaction(activity.id, emojiData.emoji, emojiData.unified);
                                              setReactionPickerOpenId(null);
                                            }}
                                            reactionsDefaultOpen
                                            reactions={DEFAULT_REACTION_UNIFIEDS}
                                            emojiStyle={EmojiStyle.NATIVE}
                                            theme={Theme.DARK}
                                            lazyLoadEmojis
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-border/60 pt-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Tipo de atividade</label>
                  <Select value={activityType} onValueChange={(value) => setActivityType(value as typeof activityType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="relative">
                    <Textarea
                      ref={activityInputRef}
                      value={activityBody}
                      onChange={(event) => setActivityBody(event.target.value)}
                      onKeyDown={handleActivityKeyDown}
                      placeholder="Descreva a atividade..."
                      rows={3}
                      className="resize-none pr-10"
                      disabled={!lead}
                    />
                    <Popover open={commentEmojiOpen} onOpenChange={setCommentEmojiOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7"
                          disabled={!lead}
                          aria-label="Adicionar emoji"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end" side="top">
                        <EmojiPicker
                          onEmojiClick={(emojiData: EmojiPickerData) => {
                            if (!emojiData?.emoji) return;
                            insertEmojiAtCursor(emojiData.emoji);
                            setCommentEmojiOpen(false);
                          }}
                          emojiStyle={EmojiStyle.NATIVE}
                          theme={Theme.DARK}
                          lazyLoadEmojis
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="default"
                  className="mt-4 w-full"
                  disabled={!lead || activitySubmitting || !activityBody.trim()}
                  onClick={handleAddActivity}
                >
                  {activitySubmitting ? "Salvando..." : "Adicionar atividade"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reenviar convite</DialogTitle>
            <DialogDescription>
              Escolha se deseja reenviar o convite para todos ou para um participante.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <RadioGroup
              value={resendTarget}
              onValueChange={(value) => setResendTarget(value as "all" | "single" | "new")}
              className="grid gap-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="resend-all" />
                <Label htmlFor="resend-all">Todos os participantes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="resend-single" />
                <Label htmlFor="resend-single">Somente um participante</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="resend-new" />
                <Label htmlFor="resend-new">Novo participante</Label>
              </div>
            </RadioGroup>

            {resendTarget === "single" && (
              <div className="grid gap-2">
                <Label>Participante</Label>
                <Select value={resendEmail} onValueChange={setResendEmail}>
                  <SelectTrigger>
                    <SelectValue placeholder={scheduleLoading ? "Carregando..." : "Selecione o email"} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildParticipantOptions().map((option) => (
                      <SelectItem key={option.email} value={option.email}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {resendTarget === "new" && (
              <div className="grid gap-2">
                <Label>Novo participante</Label>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                  {newParticipants.map((email) => (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1">
                      <span>{email}</span>
                      <button
                        type="button"
                        className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                        onClick={() =>
                          setNewParticipants((prev) => prev.filter((item) => item !== email))
                        }
                        aria-label={`Remover ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    type="text"
                    value={newParticipantDraft}
                    onChange={(event) => handleNewParticipantInput(event.target.value)}
                    onBlur={commitNewParticipantDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitNewParticipantDraft();
                      }
                    }}
                    placeholder="ex: participante@email.com"
                    className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Separe os emails por virgula ou espaco.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResendDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleResendInvite}>
                Reenviar convite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Alterar status</DialogTitle>
            <DialogDescription>
              Selecione o novo status do lead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={statusSelection} onValueChange={setStatusSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((column) => (
                    <SelectItem key={column.key} value={column.key}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
                disabled={statusUpdating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleStatusUpdate}
                disabled={
                  statusUpdating ||
                  !lead ||
                  !statusSelection ||
                  statusSelection === lead?.status
                }
              >
                {statusUpdating ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {lead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={(nextOpen) => {
            setShowFinalizeDialog(nextOpen);
            if (!nextOpen && !finalizeCompleted) {
              setOpen(true);
            }
          }}
          leadName={lead.name}
          onFinalize={handleFinalizeSubmit}
        />
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Compartilhar</DialogTitle>
            <DialogDescription>
              Compartilhe este lead com sua equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Button
                asChild
                variant="ghost"
                className="h-auto flex-col gap-2 py-3"
                disabled={!shareUrl}
              >
                <a href={whatsappShare} target="_blank" rel="noreferrer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="text-xs">WhatsApp</span>
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-auto flex-col gap-2 py-3"
                disabled={!shareUrl}
              >
                <a href={messengerShare} target="_blank" rel="noreferrer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <span className="text-xs">Messenger</span>
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-auto flex-col gap-2 py-3"
                disabled={!shareUrl}
              >
                <a href={emailShare} target="_blank" rel="noreferrer">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <span className="text-xs">Email</span>
                </a>
              </Button>
            </div>

            <div className="grid gap-2">
              <Label>Link para compartilhar</Label>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly />
                <Button type="button" variant="secondary" onClick={handleCopyShareLink} disabled={!shareUrl}>
                  <CopyIcon size={16} />
                  Copiar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
