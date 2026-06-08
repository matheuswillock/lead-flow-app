import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LeadForm } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { leadFormData } from "@/lib/validations/validationForms";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadDetails } from "@/hooks/useLeadDetails";
import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "@/app/api/v1/leads/DTO/requestToUpdateLead";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, ClipboardList, Mail, MessageCircle, MessageSquare, Phone, Smile, X } from "lucide-react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { CopyIcon } from "@/components/ui/copy";
import { FinalizeContractDialog, FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingSuccessPayload,
} from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog";
import { LeadStatusTriggerDialog, type LeadStatusTriggerPayload } from "@/app/[supabaseId]/board/features/container/LeadStatusTriggerDialog";
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes";
import type { ProfileResponseDTO, UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import type { LeadActivityReactionSummary, LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { useParams, useSearchParams } from "next/navigation";
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
import {
  useLeadActivitiesRealtime,
  type LeadActivityReactionRealtimeRow,
  type LeadActivityRealtimeRow,
} from "@/hooks/useLeadActivitiesRealtime";
import { useHealthPlans } from "@/hooks/useHealthPlans";
import { useTeamSdrs } from "@/hooks/useTeamMembersByFunction";
import { isManagerLikeRole } from "@/lib/roles";
import { isMeetingOverdue } from "@/lib/lead-meeting";
import { useTimezone } from "@/app/context/TimezoneContext";
import { MeetingHealdBlockedDialog, MeetingHealdConfirmDialog } from "@/app/[supabaseId]/components/MeetingHealdGateDialog";
import {
  SalesInfoRequirementDialog,
  type MissingSalesField,
  type SalesInfoInitialValues,
  type SalesInfoPayload,
} from "@/app/[supabaseId]/components/SalesInfoRequirementDialog";
import {
  LeadInfoRequirementDialog,
  type LeadInfoInitialValues,
  type LeadInfoPayload,
  type MissingLeadField,
} from "@/app/[supabaseId]/components/LeadInfoRequirementDialog";
import {
  formatIntimezone,
  parseLocalToUtc,
} from "@/lib/dates";
import {
  leadStatusTransitionClient,
  type LeadStatusTransitionTrigger,
} from "@/lib/services/leadStatusTransitionClient";

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

type PendingStatusConfirmation = {
  status: string;
  confirmationRuleId: string;
  message: string;
};

type PendingSalesInfoGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingSalesField[];
  currentSalesInfo: SalesInfoInitialValues;
};

type PendingLeadInfoGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingLeadField[];
  currentLeadInfo: LeadInfoInitialValues;
};

const needsStatusTriggerDialog = (status: string) =>
  status === "future_sale" || status === "opportunityLost" || status === "operator_denied";

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((mod) => mod.default), {
  ssr: false,
});

type EmojiPickerData = {
  emoji: string;
  unified: string;
};

type MentionMember = {
  profileId: string;
  name: string;
  email: string | null;
  profileIconUrl?: string | null;
  role?: UserAssociated["role"];
  functions?: UserAssociated["functions"];
  googleCalendarConnected?: boolean;
};

type MentionToken = {
  profileId: string;
  label: string;
};

type LeadOriginBadge = {
  label: string;
  variant: "default" | "secondary" | "outline";
};

const DEFAULT_REACTION_UNIFIEDS = ["1f44d", "2764-fe0f", "1f602", "1f389", "1f62e", "1f622"];

const normalizeLeadPhoneDigits = (phone: string): string => {
  if (!phone) return "";
  const numbers = phone.replace(/\D/g, "");
  if (numbers.length <= 11) return numbers;
  return numbers.slice(0, 11);
};



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
  const { tz: scheduleTimezone } = useTimezone();
  const [localLead, setLocalLead] = useState<Lead | null>(lead);
  const currentLead = localLead ?? lead;
  const currentLeadId = currentLead?.id ?? "";
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [meetingHealdSaving, setMeetingHealdSaving] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizeCompleted, setFinalizeCompleted] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<"all" | "single" | "new">("all");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [newParticipantDraft, setNewParticipantDraft] = useState("");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [scheduleGuests, setScheduleGuests] = useState<string[]>([]);
  const [_pendingSubmitData, setPendingSubmitData] = useState<leadFormData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [activityType, setActivityType] = useState<"note" | "call" | "whatsapp" | "email" | "task">("note");
  const [activityBody, setActivityBody] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [optimisticActivities, setOptimisticActivities] = useState<LeadActivityResponseDTO[]>([]);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, LeadActivityReactionSummary[]>>({});
  const [reactionPickerOpenId, setReactionPickerOpenId] = useState<string | null>(null);
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showStatusTriggerDialog, setShowStatusTriggerDialog] = useState(false);
  const [statusSelection, setStatusSelection] = useState<string>("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [pendingStatusConfirmation, setPendingStatusConfirmation] = useState<PendingStatusConfirmation | null>(null);
  const [salesInfoDialogOpen, setSalesInfoDialogOpen] = useState(false);
  const [salesInfoSaving, setSalesInfoSaving] = useState(false);
  const [pendingSalesInfoGate, setPendingSalesInfoGate] = useState<PendingSalesInfoGate | null>(null);
  const [leadInfoDialogOpen, setLeadInfoDialogOpen] = useState(false);
  const [leadInfoSaving, setLeadInfoSaving] = useState(false);
  const [pendingLeadInfoGate, setPendingLeadInfoGate] = useState<PendingLeadInfoGate | null>(null);

  useEffect(() => {
    setLocalLead(lead);
  }, [lead?.id, open]);
  const [meetingHealdGateOpen, setMeetingHealdGateOpen] = useState(false);
  const [meetingHealdBlockedOpen, setMeetingHealdBlockedOpen] = useState(false);
  const [pendingMeetingHealdGate, setPendingMeetingHealdGate] = useState<
    { status: string; trigger?: LeadStatusTransitionTrigger } | null
  >(null);
  const [teamMembers, setTeamMembers] = useState<MentionMember[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<MentionToken[]>([]);
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const activityInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activityItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ignoreMentionUpdateRef = useRef(false);
  const mergedActivitiesRef = useRef<LeadActivityResponseDTO[]>([]);
  const silentFetchTimerRef = useRef<number | null>(null);
  const appliedReactionRealtimeEventsRef = useRef<Set<string>>(new Set());
  const pendingOwnReactionOpsRef = useRef<Set<string>>(new Set());
  const params = useParams();
  const searchParams = useSearchParams();
  const supabaseId = params.supabaseId as string | undefined;
  const { activeTeamId, activeFunctions, activeRole, isTeamMaster } = useTeamContext();
  const {
    details: leadDetails,
    loading: leadDetailsLoading,
    error: leadDetailsError,
    refresh: refreshLeadDetails,
  } = useLeadDetails(currentLeadId || null, activeTeamId, supabaseId);
  const isCloserOperator =
    activeFunctions.includes("CLOSER") &&
    !isTeamMaster &&
    activeRole !== "manager" &&
    activeRole !== "backoffice";
  // Operator SDRs ficam travados no próprio nome; managers com SDR veem todos
  const isOperatorSdr =
    (activeFunctions.includes("SDR") || user?.functions?.includes("SDR")) &&
    activeRole === "operator" &&
    !isTeamMaster;
  const { healthPlans, loading: healthPlansLoading } = useHealthPlans(supabaseId, activeTeamId);
  // SDRs do time para novos leads (create mode) — usa cache do useTeamSdrs, sem request extra
  const { members: newLeadSdrs, loading: newLeadSdrsLoading, error: newLeadSdrsError } = useTeamSdrs(supabaseId, activeTeamId);
  // closersByTeam e sdrsByTeam derivados dos membros já incluídos no useLeadDetails
  const closersByTeam = useMemo(
    () => (leadDetails?.teamMembers ?? []).filter((m) => m.functions?.includes("CLOSER")),
    [leadDetails?.teamMembers]
  );
  const sdrsByTeam = useMemo(
    () => (leadDetails?.teamMembers ?? []).filter((m) => m.functions?.includes("SDR")),
    [leadDetails?.teamMembers]
  );
  // Em create mode (sem lead), usa newLeadSdrs; em edit mode usa os membros do leadDetails
  const effectiveSdrsByTeam = useMemo(
    () => (currentLead ? sdrsByTeam : newLeadSdrs),
    [currentLead, sdrsByTeam, newLeadSdrs]
  );
  const sharedLeadCode = searchParams.get("leadCode");
  const sharedActivityId = searchParams.get("activityId");
  const currentActivitiesLead =
    leadDetails?.lead?.id === currentLead?.id ? leadDetails?.lead : null;
  const isActivityLoading =
    leadDetailsLoading || (!!currentLead && leadDetails?.lead?.id !== currentLead?.id);
  // Único gating de loading do conteúdo do dialog: o useLeadDetails carrega lead,
  // anexos e membros em paralelo — basta aguardar o loading dele.
  const isLeadContentLoading = !!currentLead && leadDetailsLoading;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (currentLead?.id && open) {
      void refreshLeadDetails();
    }
  }, [currentLead?.id, open, refreshLeadDetails]);

  useEffect(() => {
    if (!open) {
      setActivityBody("");
      setActivityType("note");
      setOptimisticActivities([]);
      setReactionOverrides({});
      setReactionPickerOpenId(null);
      setCommentEmojiOpen(false);
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
      setMentionIndex(0);
      setSelectedMentions([]);
      setHighlightedActivityId(null);
      activityItemRefs.current.clear();
      setPendingSubmitData(null);
    }
  }, [open, form]);

  useEffect(() => {
    setOptimisticActivities([]);
    setReactionOverrides({});
    setReactionPickerOpenId(null);
    setSelectedMentions([]);
    setHighlightedActivityId(null);
  }, [currentLead?.id]);

  // teamMembers para o popover de menções — derivado do useLeadDetails (sem fetch separado)
  useEffect(() => {
    const members = (leadDetails?.teamMembers ?? []).map((m) => ({
      profileId: m.id,
      name: m.name,
      email: m.email ?? null,
      profileIconUrl: m.avatarImageUrl ?? null,
      role: m.role,
      functions: m.functions ?? [],
      googleCalendarConnected: m.googleCalendarConnected ?? false,
    })) as MentionMember[];
    setTeamMembers(members);
  }, [leadDetails?.teamMembers]);

  useEffect(() => {
    if (currentLead?.status) {
      setStatusSelection(currentLead.status);
    }
  }, [currentLead?.status]);

  const shareUrl = useMemo(() => {
    if (!currentLead || !origin || !currentLead.leadCode) return "";
    const url = new URL("/crm", origin);
    url.searchParams.set("leadCode", currentLead.leadCode);
    return url.toString();
  }, [currentLead, origin]);

  const shareMessage = useMemo(() => {
    if (!currentLead) return shareUrl;
    return `Lead: ${currentLead.name}\n${shareUrl}`;
  }, [currentLead, shareUrl]);

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

  const canFinalizeContract = currentLead && (
    currentLead.status === "invoicePayment" ||
    currentLead.status === "dps_agreement" ||
    currentLead.status === "offerSubmission"
  );
  const shouldShowMeetingHeald = !!currentLead && currentLead.status === "scheduled";
  const isAssignedCloser = !!(currentLead && user && currentLead.closerId && currentLead.closerId === user.id);
  const canEditMeetingHeald =
    shouldShowMeetingHeald && (isTeamMaster || isAssignedCloser);
  const canMarkNoShow =
    !!currentLead &&
    currentLead.status === "scheduled" &&
    isMeetingOverdue(currentLead.meetingDate) &&
    currentLead.meetingHeald !== "yes";
  const canReactToActivity =
    !!user && (isManagerLikeRole(user.role) || activeFunctions.includes("SDR") || activeFunctions.includes("CLOSER"));
  const statusLabel = currentLead
    ? COLUMNS.find((column) => column.key === currentLead.status)?.title || currentLead.status
    : "Status";
  const leadOriginBadge = useMemo<LeadOriginBadge | null>(() => {
    const activities = currentActivitiesLead?.activities ?? [];
    if (activities.length === 0) {
      return null;
    }

    let oldestLeadCreationActivity: LeadActivityResponseDTO | null = null;
    for (const activity of activities) {
      if (!activity?.payload || typeof activity.payload !== "object") continue;
      const payload = activity.payload as { kind?: string };
      if (payload.kind !== "lead_creation") continue;

      if (!oldestLeadCreationActivity) {
        oldestLeadCreationActivity = activity;
        continue;
      }

      const currentCreatedAt = new Date(activity.createdAt).getTime();
      const oldestCreatedAt = new Date(oldestLeadCreationActivity.createdAt).getTime();
      if (currentCreatedAt < oldestCreatedAt) {
        oldestLeadCreationActivity = activity;
      }
    }

    if (oldestLeadCreationActivity?.payload && typeof oldestLeadCreationActivity.payload === "object") {
      const payload = oldestLeadCreationActivity.payload as {
        channel?: string;
        provider?: string;
        source?: string;
      };
      const channel = typeof payload.channel === "string" ? payload.channel.toLowerCase() : "";
      const provider = typeof payload.provider === "string" ? payload.provider.toLowerCase() : "";
      const source = typeof payload.source === "string" ? payload.source.trim() : "";

      if (channel === "public_lead_form") {
        return { label: "Formulário Público", variant: "secondary" };
      }

      if (channel === "webhook" && provider === "meta") {
        return { label: "Webhook Meta", variant: "secondary" };
      }

      if (channel === "webhook" && provider === "studio") {
        return { label: source || "studio_webhook", variant: "outline" };
      }

      if (channel === "webhook") {
        return { label: "Webhook", variant: "outline" };
      }
    }

    const hasLegacyMetaOrigin = activities.some((activity) => {
      if (!activity?.body) return false;
      return activity.body.toLowerCase().includes("meta lead ads");
    });

    if (hasLegacyMetaOrigin) {
      return { label: "Webhook Meta", variant: "secondary" };
    }

    return null;
  }, [currentActivitiesLead?.activities]);

  const mentionableMembers = useMemo(() => {
    const currentUserId = user?.id;
    return teamMembers.filter((member) => member.profileId !== currentUserId);
  }, [teamMembers, user?.id]);

  const usersToAssign = useMemo<UserAssociated[]>(() => {
    return teamMembers.map((member) => ({
      id: member.profileId,
      name: member.name,
      avatarImageUrl: member.profileIconUrl || "",
      email: member.email || "",
      role: member.role ?? "operator",
      functions: member.functions ?? [],
      googleCalendarConnected: member.googleCalendarConnected ?? false,
    }));
  }, [teamMembers]);
  const fallbackClosers = useMemo(
    () =>
      closersByTeam.filter(
        (member) =>
          member.functions?.includes("CLOSER") || !member.functions || member.functions.length === 0
      ),
    [closersByTeam]
  );
  const closersFromMembers = useMemo(
    () => usersToAssign.filter((member) => member.functions?.includes("CLOSER")),
    [usersToAssign]
  );
  const availableScheduleClosers = useMemo(
    () =>
      teamMembers.length > 0
        ? closersFromMembers
        : closersFromMembers.length > 0
          ? closersFromMembers
          : fallbackClosers,
    [teamMembers.length, closersFromMembers, fallbackClosers]
  );

  const mentionMatches = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return mentionableMembers;
    return mentionableMembers.filter((member) => {
      const nameMatch = member.name?.toLowerCase().includes(query);
      const emailMatch = member.email?.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    });
  }, [mentionQuery, mentionableMembers]);

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const mentionRegex = useMemo(() => {
    const names = Array.from(
      new Set(
        teamMembers
          .map((member) => member.name)
          .filter((name): name is string => !!name && name.trim().length > 0)
      )
    );
    if (names.length === 0) return null;
    names.sort((a, b) => b.length - a.length);
    const pattern = names.map((name) => escapeRegex(name.trim())).join("|");
    if (!pattern) return null;
    return new RegExp(`@(?:${pattern})(?=$|\\s|[.,;:!?])`, "gi");
  }, [teamMembers]);

  const clearSilentLeadSyncTimer = useCallback(() => {
    if (silentFetchTimerRef.current !== null) {
      window.clearTimeout(silentFetchTimerRef.current);
      silentFetchTimerRef.current = null;
    }
  }, []);

  const scheduleSilentLeadSync = useCallback(() => {
    if (!currentLead?.id || !open) return;

    clearSilentLeadSyncTimer();

    silentFetchTimerRef.current = window.setTimeout(() => {
      silentFetchTimerRef.current = null;
      refreshLeadDetails({ silent: true });
      setReactionOverrides({});
    }, 500);
  }, [currentLead?.id, open, refreshLeadDetails, clearSilentLeadSyncTimer]);

  useEffect(() => {
    return () => {
      clearSilentLeadSyncTimer();
    };
  }, [clearSilentLeadSyncTimer]);

  useEffect(() => {
    return () => {
      clearSilentLeadSyncTimer();
    };
  }, [currentLead?.id, open, clearSilentLeadSyncTimer]);

  const applyLocalLeadPatch = useCallback(
    async (leadId: string, patch: Partial<Lead>) => {
      if (patchLead) {
        patchLead(leadId, patch);
        return;
      }

      await refreshLeads();
    },
    [patchLead, refreshLeads]
  );

  const applySchedulePayload = useCallback(
    async (payload: ScheduleMeetingSuccessPayload) => {
      await applyLocalLeadPatch(payload.leadId, {
        status: payload.status,
        email: payload.leadEmail,
        meetingDate: payload.meetingDate,
        meetingTitle: payload.meetingTitle,
        meetingNotes: payload.meetingNotes,
        meetingLink: payload.meetingLink,
        closerId: payload.closerId,
        meetingType: payload.meetingType,
      });
    },
    [applyLocalLeadPatch]
  );

  const resolveActivityAuthor = useCallback((profileId: string | null | undefined) => {
    if (!profileId) return null;

    const member = teamMembers.find((teamMember) => teamMember.profileId === profileId);
    if (member) {
      return {
        id: member.profileId,
        fullName: member.name ?? null,
        email: member.email || "",
        avatarUrl: member.profileIconUrl ?? null,
      };
    }

    if (user?.id === profileId) {
      return {
        id: user.id,
        fullName: user.fullName ?? null,
        email: user.email,
        avatarUrl: user.profileIconUrl ?? null,
      };
    }

    return null;
  }, [teamMembers, user]);

  const upsertRealtimeActivity = useCallback((activityRow: LeadActivityRealtimeRow) => {
    if (!currentLead?.id || activityRow.leadId !== currentLead.id) return;

    const normalizedActivity: LeadActivityResponseDTO = {
      id: activityRow.id,
      type: activityRow.type,
      body: activityRow.body,
      payload: activityRow.payload,
      createdAt: activityRow.createdAt,
      reactions: [],
      author: resolveActivityAuthor(activityRow.createdBy),
    };

    setOptimisticActivities((prev) => {
      const withoutMatchedOptimistic = prev.filter((activity) => {
        if (!activity.id.startsWith("optimistic-")) return true;
        if (!user?.id || activityRow.createdBy !== user.id) return true;
        return (activity.body ?? "").trim() !== (normalizedActivity.body ?? "").trim();
      });

      const existing = withoutMatchedOptimistic.find((activity) => activity.id === normalizedActivity.id);
      if (existing) {
        return withoutMatchedOptimistic.map((activity) =>
          activity.id === normalizedActivity.id ? { ...existing, ...normalizedActivity } : activity
        );
      }
      return [normalizedActivity, ...withoutMatchedOptimistic];
    });
  }, [currentLead?.id, resolveActivityAuthor, user?.id]);

  const applyRealtimeReactionChange = useCallback((
    reactionRow: LeadActivityReactionRealtimeRow,
    operation: "insert" | "delete"
  ) => {
    if (!reactionRow.activityId || !reactionRow.emojiUnified) return;

    const eventKey = `${operation}:${reactionRow.id}`;
    if (appliedReactionRealtimeEventsRef.current.has(eventKey)) {
      return;
    }
    appliedReactionRealtimeEventsRef.current.add(eventKey);
    if (appliedReactionRealtimeEventsRef.current.size > 3000) {
      const oldest = appliedReactionRealtimeEventsRef.current.values().next().value;
      if (oldest) {
        appliedReactionRealtimeEventsRef.current.delete(oldest);
      }
    }

    if (user?.id && reactionRow.profileId === user.id) {
      const ownOpKey = `${reactionRow.activityId}:${reactionRow.emojiUnified}`;
      if (pendingOwnReactionOpsRef.current.has(ownOpKey)) {
        pendingOwnReactionOpsRef.current.delete(ownOpKey);
        return;
      }
    }

    setReactionOverrides((previousOverrides) => {
      const baseline = previousOverrides[reactionRow.activityId]
        ?? mergedActivitiesRef.current.find((activity) => activity.id === reactionRow.activityId)?.reactions
        ?? [];
      const existing = baseline.find((reaction) => reaction.unified === reactionRow.emojiUnified);
      const reactedByMe = !!user?.id && reactionRow.profileId === user.id;

      let next = baseline;

      if (operation === "insert") {
        if (!existing) {
          next = [
            ...baseline,
            {
              emoji: reactionRow.emoji,
              unified: reactionRow.emojiUnified,
              count: 1,
              reactedByMe,
            },
          ];
        } else {
          next = baseline.map((reaction) =>
            reaction.unified === reactionRow.emojiUnified
              ? {
                  ...reaction,
                  count: reaction.count + 1,
                  reactedByMe: reaction.reactedByMe || reactedByMe,
                }
              : reaction
          );
        }
      } else if (existing) {
        if (existing.count <= 1) {
          next = baseline.filter((reaction) => reaction.unified !== reactionRow.emojiUnified);
        } else {
          next = baseline.map((reaction) =>
            reaction.unified === reactionRow.emojiUnified
              ? {
                  ...reaction,
                  count: Math.max(0, reaction.count - 1),
                  reactedByMe: reactedByMe ? false : reaction.reactedByMe,
                }
              : reaction
          );
        }
      }

      return {
        ...previousOverrides,
        [reactionRow.activityId]: next,
      };
    });
  }, [user?.id]);

  useEffect(() => {
    if (!mentionOpen) return;
    if (mentionIndex >= mentionMatches.length) {
      setMentionIndex(0);
    }
  }, [mentionOpen, mentionIndex, mentionMatches.length]);

  const renderActivityBodyWithMentions = (body: string) => {
    if (!mentionRegex) return body;
    const regex = new RegExp(mentionRegex.source, mentionRegex.flags);
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of body.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        parts.push(body.slice(lastIndex, index));
      }
      parts.push(
        <span key={`${index}-${match[0]}`} className="text-primary font-medium">
          {match[0]}
        </span>
      );
      lastIndex = index + match[0].length;
    }
    if (lastIndex < body.length) {
      parts.push(body.slice(lastIndex));
    }
    return parts.length > 0 ? parts : body;
  };

  const buildParticipantOptions = () => {
    const options: { label: string; email: string }[] = [];
    if (currentLead?.email) {
      options.push({ label: `${currentLead.name} (Lead)`, email: currentLead.email });
    }
    if (currentLead?.closer?.email) {
      options.push({
        label: `${currentLead.closer.fullName || currentLead.closer.email} (Closer)`,
        email: currentLead.closer.email,
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
      toast.error("Não foi possível copiar o ID");
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link de compartilhamento copiado");
    } catch (error) {
      console.error("Erro ao copiar link de compartilhamento:", error);
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleAddActivity = async () => {
    if (!currentLead?.id || !supabaseId) return;
    const trimmed = activityBody.trim();
    if (!trimmed) {
      toast.error("Informe uma mensagem para registrar a atividade");
      return;
    }

    const optimisticActivityId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const selectedMentionsSnapshot = selectedMentions;
    const optimisticActivity: LeadActivityResponseDTO = {
      id: optimisticActivityId,
      type: activityType,
      body: trimmed,
      payload: null,
      createdAt: new Date().toISOString(),
      reactions: [],
      author: user
        ? {
            id: user.id,
            fullName: user.fullName ?? null,
            email: user.email,
            avatarUrl: user.profileIconUrl ?? null,
          }
        : null,
    };

    setOptimisticActivities((prev) => [optimisticActivity, ...prev]);
    setActivityBody("");
    closeMentionList();
    setSelectedMentions([]);
    setActivitySubmitting(true);

    let normalizedBody = trimmed;
    try {
      normalizedBody = await replaceShortcodes(trimmed);
    } catch (error) {
      console.warn("Falha ao converter shortcodes de emoji:", error);
    }
    try {
      const mentionsPayload = selectedMentionsSnapshot
        .filter((mention) => {
          const mentionPattern = new RegExp(
            `@${escapeRegex(mention.label)}(?=$|\\s|[.,;:!?])`,
            "i"
          );
          return mentionPattern.test(normalizedBody);
        })
        .map((mention) => ({
          profileId: mention.profileId,
          label: mention.label,
        }));

      const response = await fetch(`/api/v1/leads/${currentLead.id}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          type: activityType,
          body: normalizedBody,
          mentions: mentionsPayload,
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
          const withoutOptimistic = prev.filter((activity) => activity.id !== optimisticActivityId);
          const existing = withoutOptimistic.find((activity) => activity.id === normalizedActivity.id);
          if (existing) {
            return withoutOptimistic.map((activity) =>
              activity.id === normalizedActivity.id ? normalizedActivity : activity
            );
          }
          return [normalizedActivity, ...withoutOptimistic];
        });
      } else {
        setOptimisticActivities((prev) => prev.filter((activity) => activity.id !== optimisticActivityId));
      }

      toast.success("Atividade registrada");
      refreshLeadDetails({ silent: true });
    } catch (error) {
      setOptimisticActivities((prev) => prev.filter((activity) => activity.id !== optimisticActivityId));
      setActivityBody(trimmed);
      setSelectedMentions(selectedMentionsSnapshot);
      console.error("Erro ao adicionar atividade:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar atividade");
    } finally {
      setActivitySubmitting(false);
    }
  };

  const formatActivityDate = (value: string) => {
    try {
      return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", scheduleTimezone)
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
    { value: "task", label: "Tarefa", icon: <ClipboardList className="h-4 w-4 text-primary" /> },
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
      case "task":
        return <ClipboardList className="h-4 w-4 text-primary" />;
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
      case "task":
        return "Tarefa";
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

  useEffect(() => {
    mergedActivitiesRef.current = mergedActivities;
  }, [mergedActivities]);

  const activeActivityIds = useMemo(
    () => mergedActivities.map((activity) => activity.id),
    [mergedActivities]
  );

  useLeadActivitiesRealtime({
    enabled: open && !!currentLead?.id,
    leadId: currentLead?.id ?? null,
    activeActivityIds,
    onActivityInserted: (activity) => {
      upsertRealtimeActivity(activity);
    },
    onReactionInserted: (reaction) => {
      applyRealtimeReactionChange(reaction, "insert");
    },
    onReactionDeleted: (reaction) => {
      applyRealtimeReactionChange(reaction, "delete");
    },
    onSyncRequested: scheduleSilentLeadSync,
  });

  const shouldScrollToSharedActivity =
    open &&
    !!sharedActivityId &&
    !!currentLead?.leadCode &&
    sharedLeadCode === currentLead.leadCode;

  useEffect(() => {
    if (!shouldScrollToSharedActivity || !sharedActivityId) return;

    const targetNode = activityItemRefs.current.get(sharedActivityId);
    if (!targetNode) {
      scheduleSilentLeadSync();
      return;
    }

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedActivityId(sharedActivityId);

    const timeout = window.setTimeout(() => {
      setHighlightedActivityId((current) =>
        current === sharedActivityId ? null : current
      );
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [
    shouldScrollToSharedActivity,
    sharedActivityId,
    mergedActivities.length,
    scheduleSilentLeadSync,
  ]);

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
    if (!currentLead?.id || !supabaseId || !activeTeamId) return;
    if (!canReactToActivity) return;

    const ownOpKey = `${activityId}:${unified}`;
    pendingOwnReactionOpsRef.current.add(ownOpKey);
    window.setTimeout(() => {
      pendingOwnReactionOpsRef.current.delete(ownOpKey);
    }, 4000);

    const previous = getReactionsForActivity(activityId);
    const optimistic = buildOptimisticReactions(previous, emoji, unified);
    setReactionOverrides((prev) => ({ ...prev, [activityId]: optimistic }));

    try {
      const response = await fetch(
        `/api/v1/leads/${currentLead.id}/activities/${activityId}/reactions`,
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
      scheduleSilentLeadSync();
    } catch (error) {
      pendingOwnReactionOpsRef.current.delete(ownOpKey);
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

  const closeMentionList = () => {
    setMentionOpen(false);
    setMentionQuery("");
    setMentionStart(null);
    setMentionIndex(0);
  };

  const getMentionMatch = (value: string, cursor: number) => {
    if (cursor < 0) return null;
    const slice = value.slice(0, cursor);
    const atIndex = slice.lastIndexOf("@");
    if (atIndex === -1) return null;
    if (atIndex > 0 && !/\s/.test(slice[atIndex - 1])) return null;
    const after = slice.slice(atIndex + 1);
    if (/\s/.test(after)) return null;
    return { start: atIndex, query: after };
  };

  const updateMentionState = (
    value: string,
    cursor: number | null,
    options?: { resetIndex?: boolean }
  ) => {
    if (cursor === null) {
      closeMentionList();
      return;
    }
    const match = getMentionMatch(value, cursor);
    if (!match) {
      closeMentionList();
      return;
    }
    setMentionOpen(true);
    setMentionStart(match.start);
    setMentionQuery(match.query);
    const shouldReset =
      options?.resetIndex ||
      match.start !== mentionStart ||
      match.query !== mentionQuery;
    if (shouldReset) {
      setMentionIndex(0);
    }
  };

  const handleActivityChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setActivityBody(nextValue);
    updateMentionState(nextValue, event.target.selectionStart, { resetIndex: true });
  };

  const handleActivityCursorUpdate = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    if (ignoreMentionUpdateRef.current) {
      ignoreMentionUpdateRef.current = false;
      return;
    }
    const target = event.currentTarget;
    updateMentionState(target.value, target.selectionStart);
  };

  const insertMentionAtCursor = (member: MentionMember) => {
    const target = activityInputRef.current;
    const cursor = target?.selectionStart ?? activityBody.length;
    const start = mentionStart ?? activityBody.lastIndexOf("@", cursor - 1);
    if (start < 0) return;
    const before = activityBody.slice(0, start);
    const after = activityBody.slice(cursor);
    const mentionText = `@${member.name}`;
    const nextValue = `${before}${mentionText} ${after}`;
    ignoreMentionUpdateRef.current = true;
    setActivityBody(nextValue);
    setSelectedMentions((prev) => {
      const exists = prev.some((mention) => mention.profileId === member.profileId);
      if (exists) return prev;
      return [
        ...prev,
        {
          profileId: member.profileId,
          label: member.name,
        },
      ];
    });
    closeMentionList();
    requestAnimationFrame(() => {
      if (!target) return;
      const nextCursor = before.length + mentionText.length + 1;
      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleActivityKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (mentionMatches.length > 0) {
          setMentionIndex((prev) => (prev + 1) % mentionMatches.length);
        }
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (mentionMatches.length > 0) {
          setMentionIndex((prev) => (prev - 1 + mentionMatches.length) % mentionMatches.length);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMentionList();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (mentionMatches.length > 0) {
          const selected = mentionMatches[mentionIndex] || mentionMatches[0];
          if (selected) {
            insertMentionAtCursor(selected);
          }
        } else {
          closeMentionList();
        }
        return;
      }
    }
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!activityBody.trim() || activitySubmitting) return;
    handleAddActivity();
  };

  const parseCurrentValue = (value?: string): number | undefined => {
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
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) {
        return parseLocalToUtc(date, scheduleTimezone).toISOString();
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
    const normalizedPhone = normalizeLeadPhoneDigits(data.phone || "");

    return {
      name: data.name,
      email: data.email || undefined,
      phone: normalizedPhone || undefined,
      meetingDate: undefined,
      meetingTitle: undefined,
      meetingNotes: undefined,
      meetingLink: undefined,
      age: data.age || undefined,
      currentHealthPlan: data.currentHealthPlan || undefined,
      currentValue: parseCurrentValue(data.currentValue),
      referenceHospital: data.referenceHospital || undefined,
      currentTreatment: data.ongoingTreatment || undefined,
      notes: data.additionalNotes || undefined,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      closerId: data.closerId || undefined,
      status: "new_opportunity" as any,
      ticket: undefined,
      contractDueDate: undefined,
      soldPlan: undefined,
      meetingType: undefined,
      isReferral: data.isReferral || false,
      referrerLeadId: data.referrerLeadId || undefined,
      referrerName: data.referrerName || undefined,
      referrerPhone: data.referrerPhone || undefined,
    };
  };

  const transformToUpdateRequest = (data: leadFormData): UpdateLeadRequest => {
    const normalizedPhone = normalizeLeadPhoneDigits(data.phone || "");

    return {
      name: data.name,
      email: data.email || undefined,
      phone: normalizedPhone || undefined,
      meetingDate: undefined,
      meetingTitle: undefined,
      meetingNotes: undefined,
      meetingLink: undefined,
      age: data.age || undefined,
      currentHealthPlan: data.currentHealthPlan || undefined,
      currentValue: parseCurrentValue(data.currentValue),
      referenceHospital: data.referenceHospital || undefined,
      currentTreatment: data.ongoingTreatment || undefined,
      notes: data.additionalNotes || undefined,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      closerId: data.closerId || undefined,
      ticket: data.ticket ? parseCurrentValue(data.ticket) : undefined,
      contractDueDate: parseMeetingDate(data.contractDueDate || ""),
      soldPlan: data.soldPlan || undefined,
      meetingType:
        currentLead?.meetingType === "online" ||
        currentLead?.meetingType === "call" ||
        currentLead?.meetingType === "whatsapp"
          ? currentLead.meetingType
          : undefined,
      isReferral: data.isReferral || false,
      referrerLeadId: data.referrerLeadId || undefined,
      referrerName: data.referrerName || undefined,
      referrerPhone: data.referrerPhone || undefined,
    };
  };

  const handleMeetingHealdChange = async (next: "yes" | "no") => {
    if (!currentLead || !supabaseId || !activeTeamId) return;
    if (currentLead.status !== "scheduled") return;
    if (!canEditMeetingHeald) return;

    const previous = (currentLead.meetingHeald ?? "no") as "yes" | "no";

    // Optimistic UI update (board/pipeline selected lead + lists).
    patchLead?.(currentLead.id, { meetingHeald: next });
    setLocalLead((prev) =>
      prev && prev.id === currentLead.id ? ({ ...prev, meetingHeald: next } as Lead) : prev,
    );
    setMeetingHealdSaving(true);

    try {
      const response = await fetch(`/api/v1/leads/${currentLead.id}`, {
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
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível atualizar a reunião.");
      }

      // Keep local state aligned with server response.
      const serverValue = (result?.result?.meetingHeald ?? next) as "yes" | "no";
      if (currentLead) {
        patchLead?.(currentLead.id, { meetingHeald: serverValue });
        setLocalLead((prev) =>
          prev && prev.id === currentLead.id ? ({ ...prev, meetingHeald: serverValue } as Lead) : prev,
        );
      }
      form.setValue("meetingHeald", serverValue, { shouldDirty: false });
    } catch (error) {
      if (currentLead) {
        patchLead?.(currentLead.id, { meetingHeald: previous });
        setLocalLead((prev) =>
          prev && prev.id === currentLead.id ? ({ ...prev, meetingHeald: previous } as Lead) : prev,
        );
      }
      form.setValue("meetingHeald", previous, { shouldDirty: false });
      toast.warning(error instanceof Error ? error.message : "Não foi possível atualizar a reunião.");
    } finally {
      setMeetingHealdSaving(false);
    }
  };

  const onSubmit = async (data: leadFormData) => {
    setIsSubmitting(true);

    try {
      if (currentLead) {
        setPendingSubmitData(null);
        const loadingToast = toast.loading("Atualizando lead...");

        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(currentLead.id, updateData);

        if (result.success) {
          toast.success(`Lead "${data.name}" atualizado com sucesso!`, {
            id: loadingToast,
            duration: 3000,
          });
          if (result.lead) {
            await applyLocalLeadPatch(currentLead.id, result.lead);
            setLocalLead((prev) =>
              prev && prev.id === currentLead.id ? ({ ...prev, ...result.lead } as Lead) : prev,
            );
          } else {
            await refreshLeads();
          }
        } else {
          toast.error(result.message || "Erro ao atualizar lead", {
            id: loadingToast,
            duration: 5000,
          });
        }
      } else {
        const loadingToast = toast.loading(`Criando lead "${data.name}"...`);

        try {
          const createData = transformToCreateRequest(data);
          const result = await createLead(createData);

          if (result.success) {
            toast.success(`Lead "${data.name}" criado com sucesso!`, {
              id: loadingToast,
              duration: 4000,
            });
            if (result.lead) {
              setLocalLead(result.lead as Lead);
            }
            await refreshLeads();
          } else {
            toast.error(result.message || "Erro ao criar lead", {
              id: loadingToast,
              duration: 5000,
            });
          }
        } catch (createError) {
          const errorMessage = createError instanceof Error ? createError.message : "Erro ao criar lead";
          const normalizedMessage = errorMessage
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

          if (errorMessage.includes("Unique constraint") || normalizedMessage.includes("ja existe")) {
            toast.error("Aviso: ja existe um lead com dados unicos em conflito (e-mail ou CNPJ)", {
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
    if (!currentLead) return;

    try {
      await finalizeContract(currentLead.id, data);
      toast.success("Contrato finalizado com sucesso!");
      setFinalizeCompleted(true);
      setShowFinalizeDialog(false);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao finalizar contrato");
      throw error;
    }
  };

  const handleNoShow = async () => {
    if (!currentLead) return;
    if (!supabaseId) {
      toast.error("Usuário não identificado");
      return;
    }

    try {
      const transitionResult = await leadStatusTransitionClient.executeStatusTransition({
        leadId: currentLead.id,
        targetStatus: "no_show",
        supabaseId,
        teamId: activeTeamId,
      });
      const { output, transition } = transitionResult;
      if (!transition.allowed || !output.isValid) {
        throw new Error(output.errorMessages?.[0] || "Erro ao marcar no-show");
      }

      const payload =
        output.result && typeof output.result === "object"
          ? (output.result as Partial<Lead>)
          : {};
      await applyLocalLeadPatch(currentLead.id, { ...payload, status: "no_show" });
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...payload, status: "no_show" } as Lead) : prev,
      );
      toast.success("Lead marcado como no-show");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar no-show");
    }
  };

  const updateLeadStatus = async (
    newStatus: string,
    trigger?: LeadStatusTransitionTrigger,
    allowAutoConfirmation = false
  ) => {
    if (!currentLead || !supabaseId) return false;

    const loadingToast = toast.loading("Atualizando status...");

    setStatusUpdating(true);
    try {
      const transitionResult = await leadStatusTransitionClient.executeStatusTransition({
        leadId: currentLead.id,
        targetStatus: newStatus,
        supabaseId,
        teamId: activeTeamId,
        trigger,
      });

      const { transition, output } = transitionResult;
      if (!transition.allowed) {
        const transitionMessage =
          output.errorMessages?.[0] || "Não foi possível concluir a mudança de status.";

        if (transition.blockerType === "meeting_heald") {
          setPendingStatusConfirmation(null);
          if (transition.canConfirmMeetingHeald) {
            setPendingMeetingHealdGate({
              status: newStatus,
              trigger: trigger ? { ...trigger } : undefined,
            });
            setMeetingHealdGateOpen(true);
          } else {
            setMeetingHealdBlockedOpen(true);
          }
          toast.info(transitionMessage, {
            id: loadingToast,
            duration: 5000,
          });
          return false;
        }

        if (transition.blockerType === "sales_info") {
          const missingFields = Array.isArray(transition.missingFields)
            ? transition.missingFields
            : [];
          const currentSalesInfo: SalesInfoInitialValues = {
            ticket:
              typeof transition.currentSalesInfo?.ticket === "number"
                ? transition.currentSalesInfo.ticket
                : currentLead.ticket ?? null,
            contractDueDate:
              typeof transition.currentSalesInfo?.contractDueDate === "string"
                ? transition.currentSalesInfo.contractDueDate
                : currentLead.contractDueDate ?? null,
            soldPlan:
              typeof transition.currentSalesInfo?.soldPlan === "string"
                ? transition.currentSalesInfo.soldPlan
                : currentLead.soldPlan ?? null,
          };

          setPendingSalesInfoGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            missingFields,
            currentSalesInfo,
          });
          setSalesInfoDialogOpen(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === "lead_info_required") {
          const missingFields = Array.isArray(transition.missingLeadFields)
            ? transition.missingLeadFields
            : [];
          const currentLeadInfo: LeadInfoInitialValues = {
            age:
              typeof transition.currentLeadInfo?.age === "string"
                ? transition.currentLeadInfo.age
                : currentLead.age ?? null,
            currentHealthPlan:
              typeof transition.currentLeadInfo?.currentHealthPlan === "string"
                ? transition.currentLeadInfo.currentHealthPlan
                : currentLead.currentHealthPlan ?? null,
            referenceHospital:
              typeof transition.currentLeadInfo?.referenceHospital === "string"
                ? transition.currentLeadInfo.referenceHospital
                : currentLead.referenceHospital ?? null,
            ongoingTreatment:
              typeof transition.currentLeadInfo?.ongoingTreatment === "string"
                ? transition.currentLeadInfo.ongoingTreatment
                : currentLead.currentTreatment ?? null,
          };

          setPendingLeadInfoGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            missingFields,
            currentLeadInfo,
          });
          setLeadInfoDialogOpen(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === "email_required") {
          toast.error(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === "confirmation") {
          const confirmationRuleId =
            typeof transition.confirmationRuleId === "string" ? transition.confirmationRuleId : null;
          const confirmationMessage =
            transition.confirmationMessage ||
            transitionMessage ||
            "Confirmação adicional é necessária para concluir esta transição.";

          if (allowAutoConfirmation) {
            if (!confirmationRuleId) {
              throw new Error(confirmationMessage);
            }
            return updateLeadStatus(
              newStatus,
              {
                ...(trigger ?? {}),
                confirmRuleId: confirmationRuleId,
              },
              false
            );
          }

          if (confirmationRuleId) {
            setPendingStatusConfirmation({
              status: newStatus,
              confirmationRuleId,
              message: confirmationMessage,
            });
            if (needsStatusTriggerDialog(newStatus)) {
              setStatusDialogOpen(false);
              setShowStatusTriggerDialog(true);
            }
            toast.info(confirmationMessage, { id: loadingToast, duration: 5000 });
            return false;
          }
        }

        if (transition.blockerType === "finalize_contract") {
          setStatusDialogOpen(false);
          setShowFinalizeDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (transition.blockerType === "schedule_required") {
          setStatusDialogOpen(false);
          setShowScheduleDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        if (
          transition.blockerType === "future_sale_trigger" ||
          transition.blockerType === "loss_reason_trigger"
        ) {
          setStatusDialogOpen(false);
          setShowStatusTriggerDialog(true);
          toast.info(transitionMessage, { id: loadingToast, duration: 5000 });
          return false;
        }

        throw new Error(transitionMessage);
      }

      if (!output.isValid) {
        throw new Error(output.errorMessages?.join(", ") || "Erro ao atualizar status");
      }

      const payload =
        output.result && typeof output.result === "object" ? (output.result as Partial<Lead>) : {};
      const scheduleResetPatch: Partial<Lead> =
        newStatus === "new_opportunity"
          ? {
              meetingDate: null,
              meetingTitle: null,
              meetingNotes: null,
              meetingLink: null,
              meetingHeald: null,
            }
          : {};

      await applyLocalLeadPatch(currentLead.id, {
        ...payload,
        ...scheduleResetPatch,
        status: newStatus as Lead["status"],
      });
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id
          ? ({ ...prev, ...payload, ...scheduleResetPatch, status: newStatus as Lead["status"] } as Lead)
          : prev,
      );
      toast.success("Status atualizado", { id: loadingToast });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar status", { id: loadingToast });
      return false;
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!currentLead || !supabaseId) return;
    const nextStatus = statusSelection || currentLead.status;
    setPendingStatusConfirmation(null);
    if (!nextStatus || nextStatus === currentLead.status) {
      setStatusDialogOpen(false);
      return;
    }
    if (nextStatus === "scheduled") {
      setStatusDialogOpen(false);
      setShowScheduleDialog(true);
      return;
    }

    const updated = await updateLeadStatus(nextStatus, undefined, false);
    if (updated) {
      setStatusDialogOpen(false);
    }
  };

  const handleStatusTriggerConfirm = async (payload: LeadStatusTriggerPayload) => {
    if (!currentLead) return;
    const nextStatus = statusSelection || currentLead.status;
    if (!nextStatus || !needsStatusTriggerDialog(nextStatus)) return;

    if (payload.kind === "future_sale") {
      const updated = await updateLeadStatus(
        nextStatus,
        {
          followUpAt: payload.followUpAt,
          followUpNotes: payload.followUpNotes,
          confirmRuleId: payload.confirmRuleId,
        },
        true
      );
      if (!updated) return;
    } else {
      const updated = await updateLeadStatus(
        nextStatus,
        {
          reason: payload.reason,
          reasonDetails: payload.reasonDetails,
          confirmRuleId: payload.confirmRuleId,
        },
        true
      );
      if (!updated) return;
    }

    setShowStatusTriggerDialog(false);
    setStatusSelection("");
  };

  const handleConfirmPendingStatusRule = async () => {
    if (!pendingStatusConfirmation) return;

    const updated = await updateLeadStatus(
      pendingStatusConfirmation.status,
      { confirmRuleId: pendingStatusConfirmation.confirmationRuleId },
      false
    );

    if (updated) {
      setPendingStatusConfirmation(null);
      setStatusDialogOpen(false);
    }
  };

  const handleSalesInfoRequirementSave = async (payload: SalesInfoPayload) => {
    if (!currentLead || !supabaseId || !pendingSalesInfoGate) return;

    setSalesInfoSaving(true);
    try {
      const response = await fetch(`/api/v1/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao salvar informações de venda");
      }

      const salesPatch =
        result.result && typeof result.result === "object"
          ? (result.result as Partial<Lead>)
          : {};
      await applyLocalLeadPatch(currentLead.id, salesPatch);
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...salesPatch } as Lead) : prev,
      );

      const updated = await updateLeadStatus(
        pendingSalesInfoGate.status,
        pendingSalesInfoGate.trigger,
        false
      );
      if (!updated) return;

      setSalesInfoDialogOpen(false);
      setPendingSalesInfoGate(null);
      setStatusDialogOpen(false);
      setShowStatusTriggerDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar informações de venda");
    } finally {
      setSalesInfoSaving(false);
    }
  };

  const handleScheduleStatusSuccess = async (payload?: ScheduleMeetingSuccessPayload) => {
    if (!currentLead) return;

    if (payload) {
      await applySchedulePayload(payload);
      setLocalLead((prev) =>
        prev && prev.id === payload.leadId
          ? ({
              ...prev,
              email: payload.leadEmail,
              status: payload.status,
              meetingDate: payload.meetingDate,
              meetingTitle: payload.meetingTitle,
              meetingNotes: payload.meetingNotes,
              meetingLink: payload.meetingLink,
              closerId: payload.closerId,
              meetingType: payload.meetingType,
            } as Lead)
          : prev,
      );
    }
  };

  const handleLeadInfoRequirementSave = async (payload: LeadInfoPayload) => {
    if (!currentLead || !supabaseId || !pendingLeadInfoGate) return;

    setLeadInfoSaving(true);
    try {
      const response = await fetch(`/api/v1/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao salvar informações do lead");
      }

      const leadPatch =
        result.result && typeof result.result === "object"
          ? (result.result as Partial<Lead>)
          : {};
      await applyLocalLeadPatch(currentLead.id, leadPatch);
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...leadPatch } as Lead) : prev,
      );

      const updated = await updateLeadStatus(
        pendingLeadInfoGate.status,
        pendingLeadInfoGate.trigger,
        false
      );
      if (!updated) return;

      setLeadInfoDialogOpen(false);
      setPendingLeadInfoGate(null);
      setStatusDialogOpen(false);
      setShowStatusTriggerDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar informações do lead");
    } finally {
      setLeadInfoSaving(false);
    }
  };

  useEffect(() => {
    if (currentLead && open) {
      const formatCurrency = (value: number): string => {
        if (value === null || value === undefined) return "";
        return `R$ ${value.toFixed(2).replace(".", ",")}`;
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
        name: currentLead.name || "",
        phone: normalizeLeadPhoneDigits(currentLead.phone || ""),
        email: currentLead.email || "",
        cnpj: formatCNPJ(currentLead.cnpj || ""),
        closerId: currentLead.closerId || "",
        age: currentLead.age || "",
        currentHealthPlan: currentLead.currentHealthPlan || undefined,
        currentValue: currentLead.currentValue ? formatCurrency(currentLead.currentValue) : "",
        referenceHospital: currentLead.referenceHospital || "",
        ongoingTreatment: currentLead.currentTreatment || "",
        additionalNotes: currentLead.notes || "",
        meetingDate: currentLead.meetingDate || "",
        meetingTitle: currentLead.meetingTitle || "",
        meetingNotes: currentLead.meetingNotes || "",
        meetingLink: currentLead.meetingLink || "",
        meetingHeald: currentLead.meetingHeald === "yes" ? "yes" : "no",
        extraGuests: "",
        responsible: currentLead.assignedTo || "",
        ticket: currentLead.ticket ? formatCurrency(currentLead.ticket) : "",
        contractDueDate: currentLead.contractDueDate || "",
        soldPlan: currentLead.soldPlan || undefined,
        isReferral: currentLead.isReferral || false,
        referrerLeadId: currentLead.referrerLeadId || "",
        referrerName: currentLead.referrerName || "",
        referrerPhone: currentLead.referrerPhone || "",
      });
    } else if (!currentLead && open) {
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
        responsible: "",
        ticket: "",
        contractDueDate: "",
        soldPlan: undefined,
        isReferral: false,
        referrerLeadId: "",
        referrerName: "",
        referrerPhone: "",
      });
    }
  }, [currentLead, open, form]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchScheduleGuests = async () => {
      if (!currentLead || !open) {
        setScheduleGuests([]);
        return;
      }
      if (!supabaseId) return;
      if (!currentLead.id) {
        setScheduleGuests([]);
        return;
      }
      if (!currentLead.meetingDate && !currentLead.meetingTitle && !currentLead.meetingLink) {
        setScheduleGuests([]);
        return;
      }
      if (isActive) {
        setScheduleLoading(true);
      }
      try {
        const response = await fetch(`/api/v1/leads/${currentLead.id}/schedule`, {
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
          meetingLink?: string | null;
        }>;
        const latest = schedules[0];
        if (isActive) {
          setScheduleGuests(latest?.extraGuests || []);
          const latestMeetingLink =
            typeof latest?.meetingLink === "string" ? latest.meetingLink.trim() : "";
          const currentLeadMeetingLink = (currentLead.meetingLink || "").trim();
          const currentFormMeetingLink = (form.getValues("meetingLink") || "").trim();
          if (latestMeetingLink && !currentLeadMeetingLink && !currentFormMeetingLink) {
            patchLead?.(currentLead.id, { meetingLink: latestMeetingLink });
            setLocalLead((prev) =>
              prev && prev.id === currentLead.id ? ({ ...prev, meetingLink: latestMeetingLink } as Lead) : prev,
            );
            form.setValue("meetingLink", latestMeetingLink, { shouldDirty: false });
          }
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
  }, [currentLead?.id, open, supabaseId, activeTeamId, form, patchLead]);

  const handleResendInvite = async () => {
    if (!currentLead || !supabaseId) return;
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
      const response = await fetch(`/api/v1/leads/${currentLead.id}/schedule/resend`, {
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
          className="bg-transparent border-none shadow-none p-0 w-[85vw] max-w-[85vw] sm:w-[80vw] sm:max-w-[80vw] lg:w-[65vw] lg:max-w-[65vw] max-h-[90vh] flex items-center justify-center [&>button]:hidden"
          onEscapeKeyDown={(e) => {
            if (isAttachmentUploading) { e.preventDefault(); return; }
            setOpen(false);
          }}
          onPointerDownOutside={(e) => {
            if (isAttachmentUploading) { e.preventDefault(); return; }
            setOpen(false);
          }}
        >
          <div className="w-full max-w-full h-[90vh] max-h-[90vh] flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm flex flex-col h-full min-h-0 lg:flex-[1_1_0%] lg:h-[95%] lg:max-h-[95%] lg:self-center dialog-scrollbar overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>
                      {currentLead ? "Editar Lead" : "Novo Lead"}
                    </DialogTitle>
                    <DialogDescription>
                      {currentLead
                        ? "Faça as alterações necessárias nos dados do lead."
                        : "Preencha os dados para criar um novo lead."
                      }
                    </DialogDescription>
                    {(currentLead?.leadCode || leadOriginBadge) && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        {currentLead?.leadCode && (
                          <div className="flex items-center gap-2">
                            <span>ID: {currentLead.leadCode}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyLeadCode(currentLead.leadCode)}
                              className="rounded-md p-1 transition-colors hover:bg-accent/60"
                              aria-label="Copiar ID do lead"
                            >
                              <CopyIcon size={16} />
                            </button>
                          </div>
                        )}
                        {leadOriginBadge && (
                          <Badge variant={leadOriginBadge.variant}>
                            {leadOriginBadge.label}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStatusSelection(currentLead?.status || "");
                              setStatusDialogOpen(true);
                            }}
                            disabled={!currentLead}
                          >
                            {statusLabel}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>clique para atualizar o status</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setShareOpen(true)}
                            disabled={!currentLead}
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
                {userLoading || isLeadContentLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        {userLoading ? "Carregando dados do usuário..." : "Carregando lead..."}
                      </p>
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
                    healthPlanOptions={healthPlans}
                    healthPlanOptionsLoading={healthPlansLoading}
                    onCancel={() => setOpen(false)}
                    usersToAssign={usersToAssign}
                    closersToAssign={availableScheduleClosers}
                    sdrsToAssign={effectiveSdrsByTeam}
                      closersLoading={leadDetailsLoading}
                      closersError={leadDetailsError}
                    sdrsLoading={currentLead ? leadDetailsLoading : newLeadSdrsLoading}
                    sdrsError={currentLead ? leadDetailsError : newLeadSdrsError}
                      leadId={currentLead?.id}
                      onUploadStateChange={setIsAttachmentUploading}
                      initialAttachments={leadDetails?.attachments}
                      scheduleSummary={
                        currentLead
                          ? {
                              status: currentLead.status,
                              meetingDate: currentLead.meetingDate,
                              closerName:
                                currentLead.closer?.fullName ||
                                currentLead.closer?.email ||
                                null,
                              meetingTitle: currentLead.meetingTitle,
                              meetingNotes: currentLead.meetingNotes,
                              meetingLink: currentLead.meetingLink,
                              meetingHeald: currentLead.meetingHeald,
                            }
                          : undefined
                      }
                      onManageSchedule={currentLead ? () => setShowScheduleDialog(true) : undefined}
                      canToggleMeetingHeald={canEditMeetingHeald}
                      meetingHealdSaving={meetingHealdSaving}
                      onMeetingHealdChange={canEditMeetingHeald ? handleMeetingHealdChange : undefined}
                      canMarkNoShow={canMarkNoShow}
                      onMarkNoShow={handleNoShow}
                      isEditMode={!!currentLead}
                      currentProfileId={user.id}
                      currentUserIsSdr={isOperatorSdr}
                      currentUserIsCloser={isCloserOperator}
                      supabaseId={supabaseId}
                      activeTeamId={activeTeamId ?? undefined}
                    />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm flex flex-col min-h-0 lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] lg:h-[95%] lg:max-h-[95%] lg:self-center">
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
                {!currentLead ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    Atividades disponíveis após criar o lead.
                  </div>
                ) : leadDetailsError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {leadDetailsError}
                  </div>
                ) : isActivityLoading || isLeadContentLoading ? (
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
                          const taskPayload =
                            activity.type === "task" && activity.payload && typeof activity.payload === "object"
                              ? (activity.payload as {
                                  kind?: string;
                                  title?: string;
                                  status?: string;
                                  isUrgent?: boolean;
                                  assigneeMentions?: Array<{ profileId?: string; label?: string }>;
                                })
                              : null;
                          const taskTitle = taskPayload?.title?.trim() || "Sem título";
                          const isTaskStatusUpdate = taskPayload?.kind === "task_status_update";
                          const taskMentions = (taskPayload?.assigneeMentions ?? [])
                            .map((entry) => entry?.label?.trim())
                            .map((value) => (value && !value.startsWith("@") ? `@${value}` : value))
                            .filter((value): value is string => Boolean(value));
                          const taskAssignedText =
                            taskMentions.length > 0
                              ? `Nova task atribuída para ${taskMentions.join(", ")}`
                              : "Nova task atribuída";
                          const taskStatusText = taskPayload?.status === "DONE" ? "Task concluída" : "Status da task atualizado";
                          const taskHeaderText = isTaskStatusUpdate ? taskStatusText : taskAssignedText;
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
                              ref={(node) => {
                                if (node) {
                                  activityItemRefs.current.set(activity.id, node);
                                } else {
                                  activityItemRefs.current.delete(activity.id);
                                }
                              }}
                              className={cn(
                                "rounded-lg border border-border/60 bg-background/60 p-3 w-77 max-w-full mr-auto transition-colors",
                                highlightedActivityId === activity.id
                                  ? "ring-2 ring-primary/50 bg-primary/5"
                                  : ""
                              )}
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
                              {activity.type === "task" ? (
                                <div className="col-span-2 flex flex-col gap-1">
                                  <p className="text-xs font-medium text-primary">{taskHeaderText}</p>
                                  <p className="text-sm font-semibold text-foreground">{taskTitle}</p>
                                  {taskPayload?.isUrgent ? (
                                    <Badge variant="destructive" className="w-fit">
                                      Urgente
                                    </Badge>
                                  ) : null}
                                  {activity.body && (
                                    <p className="text-sm text-muted-foreground whitespace-pre-line wrap-break-word">
                                      {renderActivityBodyWithMentions(activity.body)}
                                    </p>
                                  )}
                                </div>
                              ) : activity.body ? (
                                <p className="col-span-2 text-sm text-muted-foreground whitespace-pre-line wrap-break-word">
                                  {renderActivityBodyWithMentions(activity.body)}
                                </p>
                              ) : null}
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
                    <SelectTrigger className="">
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
                {activityType === "task" ? (
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                    <p className="mb-3 text-xs">
                      Atribua uma tarefa a um ou mais membros do time. Você pode definir urgência, datas de início e fim.
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      className="w-full"
                      disabled={!currentLead}
                      onClick={() => setTaskDialogOpen(true)}
                    >
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Criar tarefa
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid gap-2">
                      <div className="relative">
                        <Textarea
                          ref={activityInputRef}
                          value={activityBody}
                          onChange={handleActivityChange}
                          onKeyUp={handleActivityCursorUpdate}
                          onClick={handleActivityCursorUpdate}
                          onKeyDown={handleActivityKeyDown}
                          placeholder="Descreva a atividade..."
                          rows={3}
                          className="resize-none pr-10"
                          disabled={!currentLead}
                        />
                        {mentionOpen && currentLead && (
                          <div className="absolute bottom-full left-0 mb-2 w-full rounded-md border border-border/60 bg-background shadow-sm z-50">
                            {leadDetailsLoading ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                Carregando membros...
                              </div>
                            ) : leadDetailsError ? (
                              <div className="px-3 py-2 text-xs text-destructive">
                                {leadDetailsError}
                              </div>
                            ) : mentionMatches.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">
                                Nenhum usuário encontrado.
                              </div>
                            ) : (
                              <div className="max-h-44 overflow-y-auto py-1">
                                {mentionMatches.map((member, index) => {
                                  const isActive = index === mentionIndex;
                                  return (
                                    <button
                                      key={member.profileId}
                                      type="button"
                                      className={cn(
                                        "flex w-full px-3 py-2 text-left text-sm transition",
                                        isActive
                                          ? "bg-muted/60 text-foreground"
                                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                      )}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onMouseEnter={() => setMentionIndex(index)}
                                      onClick={() => insertMentionAtCursor(member)}
                                    >
                                      <span className="font-medium">{member.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <Popover open={commentEmojiOpen} onOpenChange={setCommentEmojiOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 h-7 w-7"
                              disabled={!currentLead}
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
                      disabled={!currentLead || activitySubmitting || !activityBody.trim()}
                      onClick={handleAddActivity}
                    >
                      {activitySubmitting ? "Salvando..." : "Adicionar atividade"}
                    </Button>
                  </>
                )}
              </div>

              {currentLead && supabaseId && activeTeamId && (
                <TaskFormDialog
                  open={taskDialogOpen}
                  onOpenChange={setTaskDialogOpen}
                  leadId={currentLead.id}
                  leadName={currentLead.name}
                  teamMembers={(user as ProfileResponseDTO | null)?.usersAssociated ?? []}
                  supabaseId={supabaseId}
                  activeTeamId={activeTeamId}
                  onSuccess={() => {
                    setActivityType("note");
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="sm:max-w-105">
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
                    <SelectValue placeholder={scheduleLoading ? "Carregando..." : "Selecione o e-mail"} />
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
                    className="min-w-35 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
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

      <Dialog
        open={statusDialogOpen}
        onOpenChange={(nextOpen) => {
          setStatusDialogOpen(nextOpen);
          if (!nextOpen) setStatusSelection("");
        }}
      >
        <DialogContent className="sm:max-w-105">
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

      {currentLead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={(nextOpen) => {
            setShowFinalizeDialog(nextOpen);
            if (!nextOpen && !finalizeCompleted) {
              setOpen(true);
            }
          }}
          leadName={currentLead.name}
          leadCloserId={currentLead.closerId ?? undefined}
          onFinalize={handleFinalizeSubmit}
          closers={availableScheduleClosers}
          healthPlans={healthPlans}
          initialAmount={currentLead.ticket}
          initialStartDate={currentLead.contractDueDate}
          initialOperadora={currentLead.soldPlan}
          initialHolderCnpj={currentLead.cnpj}
        />
      )}

      {currentLead && (
        <ScheduleMeetingDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          lead={currentLead}
          onScheduleSuccess={handleScheduleStatusSuccess}
          closers={closersByTeam}
          teamMembers={usersToAssign}
          mode={currentLead.meetingDate ? "reschedule" : "create"}
          initialExtraGuests={scheduleGuests}
          currentProfileId={user?.id}
        />
      )}

      {currentLead && statusSelection && needsStatusTriggerDialog(statusSelection) && (
        <LeadStatusTriggerDialog
          open={showStatusTriggerDialog}
          onOpenChange={setShowStatusTriggerDialog}
          mode={statusSelection === "future_sale" ? "future_sale" : "loss_reason"}
          leadName={currentLead.name}
          statusLabel={COLUMNS.find((column) => column.key === statusSelection)?.title || statusSelection}
          confirmationMessage={
            pendingStatusConfirmation?.status === statusSelection
              ? pendingStatusConfirmation.message
              : null
          }
          confirmationRuleId={
            pendingStatusConfirmation?.status === statusSelection
              ? pendingStatusConfirmation.confirmationRuleId
              : null
          }
          onConfirm={handleStatusTriggerConfirm}
        />
      )}

      <AlertDialog
        open={!!pendingStatusConfirmation && !needsStatusTriggerDialog(pendingStatusConfirmation?.status || "")}
        onOpenChange={(open) => {
          if (!open) setPendingStatusConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação necessária</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusConfirmation?.message || "Deseja confirmar esta transição de status?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPendingStatusRule();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MeetingHealdConfirmDialog
        open={meetingHealdGateOpen}
        onOpenChange={(open) => {
          setMeetingHealdGateOpen(open);
          if (!open) setPendingMeetingHealdGate(null);
        }}
        onConfirm={async () => {
          if (!pendingMeetingHealdGate) return;
          const mergedTrigger = {
            ...(pendingMeetingHealdGate.trigger ?? {}),
            meetingHeald: "yes" as const,
          };
          const updated = await updateLeadStatus(pendingMeetingHealdGate.status, mergedTrigger, false);
          if (updated) {
            setMeetingHealdGateOpen(false);
            setPendingMeetingHealdGate(null);
            setStatusDialogOpen(false);
            setShowStatusTriggerDialog(false);
          }
        }}
      />

      <MeetingHealdBlockedDialog
        open={meetingHealdBlockedOpen}
        onOpenChange={setMeetingHealdBlockedOpen}
      />

      {currentLead && (
        <SalesInfoRequirementDialog
          open={salesInfoDialogOpen}
          onOpenChange={(nextOpen) => {
            setSalesInfoDialogOpen(nextOpen);
            if (!nextOpen) {
              setPendingSalesInfoGate(null);
            }
          }}
          onSave={handleSalesInfoRequirementSave}
          healthPlans={healthPlans}
          leadName={currentLead.name}
          isSaving={salesInfoSaving}
          initialValues={pendingSalesInfoGate?.currentSalesInfo}
          missingFields={pendingSalesInfoGate?.missingFields}
        />
      )}

      {currentLead && (
        <LeadInfoRequirementDialog
          open={leadInfoDialogOpen}
          onOpenChange={(nextOpen) => {
            setLeadInfoDialogOpen(nextOpen);
            if (!nextOpen) {
              setPendingLeadInfoGate(null);
            }
          }}
          onSave={handleLeadInfoRequirementSave}
          leadName={currentLead.name}
          isSaving={leadInfoSaving}
          initialValues={pendingLeadInfoGate?.currentLeadInfo}
          missingFields={pendingLeadInfoGate?.missingFields}
        />
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-130">
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
                  <span className="text-xs">E-mail</span>
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
