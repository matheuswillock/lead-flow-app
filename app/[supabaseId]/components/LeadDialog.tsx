import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LeadForm } from "@/components/forms/leadForm";
import type { LeadFormSaveMode } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { useLeadCustomFieldDefinitions } from "@/hooks/useLeadCustomFieldDefinitions";
import { buildLeadCustomFieldsSchema } from "@/lib/leadCustomFields/schema";
import type { LeadFormWithCustomFields } from "@/hooks/useForms";
import { isDraftLead } from "@/lib/lead-status";
import { normalizeLeadPhoneDigits } from "@/lib/masks";
import { resolveActivityAuthor as resolveActivityAuthorFromLib } from "@/lib/lead-activities/resolveActivityAuthor";
import { DraftLeadIndicator } from "@/app/[supabaseId]/components/DraftLeadIndicator";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadDetails } from "@/hooks/useLeadDetails";
import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "@/app/api/v1/leads/DTO/requestToUpdateLead";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, CheckCircle, ClipboardList, Copy, Mail, MessageCircle, MessageSquare, Phone, Smile, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "@/components/animate-ui/icons/external-link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTeamContext } from "@/app/context/TeamContext";
import { useOperationalAccess } from "@/app/context/OperationalAccessContext";
import { Textarea } from "@/components/ui/textarea";
import { LeadTagsTab } from "@/app/[supabaseId]/components/lead-tags/LeadTagsTab";
import { LeadContactsTab } from "@/app/[supabaseId]/components/lead-contacts/LeadContactsTab";
import { LeadDocumentRequestsTab } from "@/app/[supabaseId]/components/lead-document-requests/LeadDocumentRequestsTab";
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
import { isMeetingOverdue, canConfirmMeetingPresence } from "@/lib/lead-meeting";
import { useTimezone } from "@/app/context/TimezoneContext";
import { MeetingHealdBlockedDialog, MeetingHealdConfirmDialog } from "@/app/[supabaseId]/components/MeetingHealdGateDialog";
import { TransferBetweenTeamsDialog } from "@/app/[supabaseId]/board/features/container/TransferBetweenTeamsDialog";
import { ResendScheduleInviteDialog } from "@/app/[supabaseId]/board/features/components/ResendScheduleInviteDialog";
import {
  SalesInfoRequirementDialog,
  type MissingSalesField,
  type SalesInfoInitialValues,
  type SalesInfoPayload,
} from "@/app/[supabaseId]/components/SalesInfoRequirementDialog";
import {
  CloserRequirementDialog,
  type CloserRequirementPayload,
} from "@/app/[supabaseId]/components/CloserRequirementDialog";
import {
  LeadInfoRequirementDialog,
  type LeadInfoInitialValues,
  type LeadInfoPayload,
  type MissingLeadField,
} from "@/app/[supabaseId]/components/LeadInfoRequirementDialog";
import {
  parseLocalToUtc,
} from "@/lib/dates";
import {
  leadStatusTransitionClient,
  type LeadStatusTransitionTrigger,
} from "@/lib/services/leadStatusTransitionClient";
import { mapLeadInfoPayloadForUpdate } from "@/lib/leadStatusTransitionFields";
import { useFeatureAccess } from "@/app/context/FeatureAccessContext";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { LeadWhatsAppCard } from "@/app/[supabaseId]/components/LeadWhatsAppCard";
import { LeadRadarTemperatureCard } from "@/app/[supabaseId]/components/LeadRadarTemperatureCard";
import { LeadActivityTimeline } from "@/app/[supabaseId]/components/lead-timeline/LeadActivityTimeline";
import { LeadDuplicateWarningDialog } from "@/app/[supabaseId]/components/LeadDuplicateWarningDialog";
import { LeadMergeDialog } from "@/app/[supabaseId]/components/LeadMergeDialog";
import type { LeadDuplicateCandidateDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO";
import { API_CLIENT_BASE } from "@/lib/route-map";

type LeadDialogLeftTab = "dados" | "tags" | "contatos" | "documentos";

interface LeadDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  lead: Lead | null;
  user: ProfileResponseDTO | null;
  userLoading: boolean;
  refreshLeads: () => Promise<void>;
  patchLead?: (leadId: string, patch: Partial<Lead>) => void;
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
  defaultTab?: LeadDialogLeftTab;
}

type PendingStatusConfirmation = {
  status: string;
  confirmationRuleId: string;
  message: string;
};


function LeadPublicFormResponses({ leadId, teamId, supabaseId }: { leadId: string; teamId: string; supabaseId: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completionLabel = (status?: string) => {
    if (status === "complete") return "Completo";
    if (status === "partial") return "Parcial";
    return "Inicial";
  };
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_CLIENT_BASE}/teams/${teamId}/leads/${leadId}/public-form-submissions`, {
      headers: { "x-supabase-user-id": supabaseId, "x-team-id": teamId },
      signal: controller.signal,
    }).then(async (response) => {
      const output = await response.json();
      if (!response.ok || !output.isValid) throw new Error(output.errorMessages?.[0] ?? "Erro ao carregar respostas");
      setItems(output.result ?? []);
    }).catch((fetchError) => {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      setError(fetchError instanceof Error ? fetchError.message : "Erro ao carregar respostas");
    });
    return () => controller.abort();
  }, [leadId, teamId, supabaseId]);
  if (error) return <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>;
  if (!items) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }
  if (!items.length) return <div className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Este lead ainda não respondeu formulários públicos.</div>;
  return (
    <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
      {items.map((submission) => (
        <div className="rounded-lg border p-3" key={submission.id}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{submission.form.name}</p>
              <p className="text-xs text-muted-foreground">
                Versão {submission.publication.version} ·{" "}
                {new Date(submission.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {submission.completionStatus ? (
                <Badge variant="outline">{completionLabel(submission.completionStatus)}</Badge>
              ) : null}
              {submission.scoreBandLabel ? (
                <Badge variant="secondary">
                  {submission.scoreBandLabel} · {submission.score} pts
                </Badge>
              ) : null}
            </div>
          </div>
          {submission.errorMessage ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{submission.errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-3 space-y-2">
            {submission.answers.map((answer: any) => {
              const snapshot = answer.questionSnapshot as { title?: string };
              const value = Array.isArray(answer.value)
                ? answer.value.join(", ")
                : typeof answer.value === "object"
                  ? JSON.stringify(answer.value)
                  : String(answer.value ?? "—");
              return (
                <div key={answer.id}>
                  <p className="text-xs font-medium text-muted-foreground">
                    {snapshot.title ?? "Pergunta"}
                  </p>
                  <p className="text-sm break-words">{value}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type PendingSalesInfoGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  missingFields: MissingSalesField[];
  currentSalesInfo: SalesInfoInitialValues;
};

type PendingCloserGate = {
  status: string;
  trigger?: LeadStatusTransitionTrigger;
  currentCloserId: string | null;
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




export default function LeadDialog({
  open,
  setOpen,
  lead,
  user,
  userLoading,
  refreshLeads,
  patchLead,
  finalizeContract,
  defaultTab = "dados",
}: LeadDialogProps) {
  const { tz: scheduleTimezone } = useTimezone();
  const [localLead, setLocalLead] = useState<Lead | null>(lead);
  const currentLead = localLead ?? lead;
  const currentLeadId = currentLead?.id ?? "";
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [meetingHealdSaving, setMeetingHealdSaving] = useState(false);
  const [meetingPresenceConfirmSaving, setMeetingPresenceConfirmSaving] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizeCompleted, setFinalizeCompleted] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [scheduleGuests, setScheduleGuests] = useState<string[]>([]);
  const [_pendingSubmitData, setPendingSubmitData] = useState<LeadFormWithCustomFields | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shortShareUrl, setShortShareUrl] = useState("");
  const [scheduleShareDialogOpen, setScheduleShareDialogOpen] = useState(false);
  const [scheduleShareUrl, setScheduleShareUrl] = useState("");
  const [scheduleShareExpiresAt, setScheduleShareExpiresAt] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [activityType, setActivityType] = useState<"note" | "call" | "whatsapp" | "email" | "task">("note");
  const [sidePanelTab, setSidePanelTab] = useState<"activities" | "forms">("activities");
  const [leftPanelTab, setLeftPanelTab] = useState<LeadDialogLeftTab>(defaultTab);
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
  const [closerRequirementDialogOpen, setCloserRequirementDialogOpen] = useState(false);
  const [closerRequirementSaving, setCloserRequirementSaving] = useState(false);
  const [pendingCloserGate, setPendingCloserGate] = useState<PendingCloserGate | null>(null);
  const [leadInfoDialogOpen, setLeadInfoDialogOpen] = useState(false);
  const [leadInfoSaving, setLeadInfoSaving] = useState(false);
  const [pendingLeadInfoGate, setPendingLeadInfoGate] = useState<PendingLeadInfoGate | null>(null);
  const [showTransferBetweenTeamsDialog, setShowTransferBetweenTeamsDialog] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<LeadDuplicateCandidateDTO[]>([]);
  const [pendingDuplicateCreate, setPendingDuplicateCreate] = useState<{
    data: CreateLeadRequest;
    saveAsDraft: boolean;
  } | null>(null);
  const [duplicateConfirming, setDuplicateConfirming] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [isTransferToggling, setIsTransferToggling] = useState(false);

  useEffect(() => {
    setLocalLead(lead);
  }, [lead?.id, open]);

  useEffect(() => {
    if (!open) return;
    const nextTab = !currentLeadId && defaultTab !== "dados" ? "dados" : defaultTab;
    setLeftPanelTab(nextTab);
  }, [open, defaultTab, currentLeadId]);

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
  const { activeTeamId, activeTeam, activeFunctions, activeRole, isTeamMaster } = useTeamContext();
  const leadDetailsTeamId = currentLead?.teamId ?? activeTeamId ?? null;
  const {
    details: leadDetails,
    loading: leadDetailsLoading,
    error: leadDetailsError,
    refresh: refreshLeadDetails,
  } = useLeadDetails(currentLeadId || null, leadDetailsTeamId, supabaseId);
  const customFieldsTeamId = useMemo(
    () => leadDetails?.lead?.teamId ?? currentLead?.teamId ?? activeTeamId ?? null,
    [leadDetails?.lead?.teamId, currentLead?.teamId, activeTeamId]
  );
  const {
    activeDefinitions: leadCustomFieldDefinitions,
    isLoading: leadCustomFieldDefinitionsLoading,
    refresh: refreshLeadCustomFieldDefinitions,
  } = useLeadCustomFieldDefinitions({
    teamId: customFieldsTeamId,
    supabaseId,
  });
  const form = useLeadForm(leadCustomFieldDefinitions);
  const { hasAccess } = useFeatureAccess();
  const { access: operationalAccess } = useOperationalAccess();
  const canTransferBetweenTeams =
    isTeamMaster || Boolean(activeTeam?.canTransferAccountLeads);
  const canMergeLead =
    Boolean(currentLead) &&
    (isTeamMaster || isManagerLikeRole(activeRole ?? user?.role ?? ""));
  const allowedTransferTargetIds = useMemo(
    () => (leadDetails?.transferTargets ?? []).map((target) => target.teamId),
    [leadDetails?.transferTargets]
  );
  // MultiSkill origin teams may have no internal transfer route yet the external
  // MultiSkill lookup still yields valid targets. multiskillExternalTransfer is a
  // team-level flag, not a per-user one, so it must still respect transfer delegation.
  const hasTransferTargets =
    allowedTransferTargetIds.length > 0 ||
    (canTransferBetweenTeams && operationalAccess.multiskillExternalTransfer);
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
  const scheduleCloserName = useMemo(() => {
    if (!currentLead || currentLead.isTransfer === true) return null;
    if (currentLead.closer?.fullName || currentLead.closer?.email) {
      return currentLead.closer.fullName || currentLead.closer.email || null;
    }
    if (!currentLead.closerId) return null;
    const closerMember = closersByTeam.find((member) => member.id === currentLead.closerId);
    return closerMember?.name || closerMember?.email || null;
  }, [closersByTeam, currentLead]);
  const sharedLeadCode = searchParams.get("leadCode");
  const sharedActivityId = searchParams.get("activityId");
  const currentActivitiesLead =
    leadDetails?.lead?.id === currentLead?.id ? leadDetails?.lead : null;
  const isActivityLoading =
    leadDetailsLoading || (!!currentLead && leadDetails?.lead?.id !== currentLead?.id);
  // Único gating de loading do conteúdo do dialog: o useLeadDetails carrega lead,
  // anexos e membros em paralelo — basta aguardar o loading dele.
  const isCustomFieldsLoading =
    Boolean(customFieldsTeamId) && leadCustomFieldDefinitionsLoading;
  const isLeadContentLoading =
    (!!currentLead && leadDetailsLoading) || isCustomFieldsLoading;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

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

  useEffect(() => {
    if (!leadDetails?.lead || leadDetails.lead.id !== currentLeadId) return;
    setLocalLead((prev) =>
      prev?.id === leadDetails.lead.id
        ? ({ ...prev, ...leadDetails.lead } as Lead)
        : (leadDetails.lead as Lead)
    );
  }, [leadDetails?.lead, currentLeadId]);

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

  useEffect(() => {
    setShortShareUrl("");
    if (!shareUrl || !supabaseId || !activeTeamId) return;
    let cancelled = false;
    fetch("/api/v1/short-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId,
      },
      body: JSON.stringify({ targetUrl: shareUrl }),
    })
      .then((res) => res.json())
      .then((output) => {
        if (!cancelled && output?.isValid && output?.result?.shortUrl) {
          setShortShareUrl(output.result.shortUrl as string);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [shareUrl, supabaseId, activeTeamId]);

  const displayShareUrl = shortShareUrl || shareUrl;

  const shareMessage = useMemo(() => {
    if (!currentLead) return displayShareUrl;
    return `Lead: ${currentLead.name}\n${displayShareUrl}`;
  }, [currentLead, displayShareUrl]);

  const whatsappShare = useMemo(() => {
    if (!displayShareUrl) return "#";
    return `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, displayShareUrl]);

  const messengerShare = useMemo(() => {
    if (!displayShareUrl) return "#";
    return `https://www.messenger.com/share?link=${encodeURIComponent(displayShareUrl)}`;
  }, [displayShareUrl]);

  const emailShare = useMemo(() => {
    if (!displayShareUrl) return "#";
    const subject = encodeURIComponent("Lead compartilhado");
    return `mailto:?subject=${subject}&body=${encodeURIComponent(shareMessage)}`;
  }, [shareMessage, displayShareUrl]);

  const canFinalizeContract = currentLead && (
    currentLead.status === "invoicePayment" ||
    currentLead.status === "dps_agreement" ||
    currentLead.status === "offerSubmission"
  );
  const shouldShowMeetingHeald = !!currentLead && currentLead.status === "scheduled";
  const isAssignedCloser = !!(currentLead && user && currentLead.closerId && currentLead.closerId === user.id);
  const canEditMeetingHeald =
    shouldShowMeetingHeald && (isTeamMaster || isAssignedCloser);
  const isAssignedSdr = !!(currentLead && user && currentLead.assignedTo === user.id);
  const canEditMeetingPresence =
    !!currentLead &&
    currentLead.isTransfer !== true &&
    canConfirmMeetingPresence({
      status: currentLead.status,
      meetingDate: currentLead.meetingDate,
      isTransfer: currentLead.isTransfer,
    }) &&
    (isTeamMaster || isManagerLikeRole(user?.role ?? "") || isAssignedSdr || isAssignedCloser);
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
        formName?: string;
      };
      const channel = typeof payload.channel === "string" ? payload.channel.toLowerCase() : "";
      const provider = typeof payload.provider === "string" ? payload.provider.toLowerCase() : "";
      const source = typeof payload.source === "string" ? payload.source.trim() : "";
      const formName = typeof payload.formName === "string" ? payload.formName.trim() : "";

      if (channel === "public_form" || channel === "public_lead_form") {
        return { label: formName || source || "Formulário público", variant: "secondary" };
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

  const resolveActivityAuthor = useCallback((
    profileId: string | null | undefined,
    payload?: Record<string, unknown> | null
  ) => resolveActivityAuthorFromLib(profileId, payload, { teamMembers, user }),
  [teamMembers, user]);

  const upsertRealtimeActivity = useCallback((activityRow: LeadActivityRealtimeRow) => {
    if (!currentLead?.id || activityRow.leadId !== currentLead.id) return;

    const normalizedActivity: LeadActivityResponseDTO = {
      id: activityRow.id,
      type: activityRow.type,
      body: activityRow.body,
      payload: activityRow.payload,
      createdAt: activityRow.createdAt,
      reactions: [],
      author: resolveActivityAuthor(activityRow.createdBy, activityRow.payload as Record<string, unknown> | null),
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
    if (!displayShareUrl) return;
    try {
      await navigator.clipboard.writeText(displayShareUrl);
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

      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}/activities`, {
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

  const activityTypeOptions = [
    { value: "note", label: "Comentário", icon: <MessageSquare className="h-4 w-4 text-primary" /> },
    { value: "call", label: "Ligação", icon: <Phone className="h-4 w-4 text-primary" /> },
    { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4 text-primary" /> },
    { value: "email", label: "Email", icon: <Mail className="h-4 w-4 text-primary" /> },
    { value: "task", label: "Tarefa", icon: <ClipboardList className="h-4 w-4 text-primary" /> },
  ];

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
        `${API_CLIENT_BASE}/leads/${currentLead.id}/activities/${activityId}/reactions`,
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

  const handleConfirmDuplicateCreate = async () => {
    if (!pendingDuplicateCreate || duplicateConfirming) return;

    setDuplicateConfirming(true);
    const loadingToast = toast.loading(
      pendingDuplicateCreate.saveAsDraft
        ? `Salvando rascunho "${pendingDuplicateCreate.data.name}"...`
        : `Criando lead "${pendingDuplicateCreate.data.name}"...`
    );

    try {
      const result = await createLead({
        ...pendingDuplicateCreate.data,
        confirmDuplicate: true,
      });

      if (result.success) {
        toast.success(
          pendingDuplicateCreate.saveAsDraft
            ? `Rascunho "${pendingDuplicateCreate.data.name}" salvo com sucesso!`
            : `Lead "${pendingDuplicateCreate.data.name}" criado com sucesso!`,
          { id: loadingToast, duration: 4000 }
        );
        if (result.lead) {
          form.setValue("razaoSocial", result.lead.razaoSocial ?? "", { shouldDirty: false });
          setLocalLead(result.lead as Lead);
        }
        await refreshLeads();
        setDuplicateDialogOpen(false);
        setPendingDuplicateCreate(null);
        setDuplicateCandidates([]);
      } else {
        toast.error(result.message || "Erro ao criar lead", {
          id: loadingToast,
          duration: 5000,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar lead", {
        id: loadingToast,
        duration: 5000,
      });
    } finally {
      setDuplicateConfirming(false);
    }
  };

  const transformToCreateRequest = (data: LeadFormWithCustomFields, saveAsDraft: boolean): CreateLeadRequest => {
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
      saveAsDraft,
      isTransfer: data.isTransfer || false,
      ticket: undefined,
      contractDueDate: undefined,
      soldPlan: undefined,
      meetingType: undefined,
      isReferral: data.isReferral || false,
      referrerLeadId: data.referrerLeadId || undefined,
      referrerName: data.referrerName || undefined,
      referrerPhone: data.referrerPhone || undefined,
      customFields:
        data.customFields && Object.keys(data.customFields).length > 0
          ? data.customFields
          : undefined,
    };
  };

  const transformToUpdateRequest = (data: LeadFormWithCustomFields, saveAsDraft: boolean): UpdateLeadRequest => {
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
      isTransfer: data.isTransfer || false,
      isReferral: data.isReferral || false,
      referrerLeadId: data.referrerLeadId || undefined,
      referrerName: data.referrerName || undefined,
      referrerPhone: data.referrerPhone || undefined,
      saveAsDraft,
      customFields:
        data.customFields && Object.keys(data.customFields).length > 0
          ? data.customFields
          : undefined,
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
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
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

  const handleMeetingPresenceConfirm = async () => {
    if (!currentLead || !supabaseId || !activeTeamId) return;
    if (!canEditMeetingPresence) return;
    if (currentLead.meetingPresenceConfirmed === true) return;

    const previousPresenceConfirmed = currentLead.meetingPresenceConfirmed ?? false;
    const previousPresenceConfirmedAt = currentLead.meetingPresenceConfirmedAt ?? null;

    patchLead?.(currentLead.id, { meetingPresenceConfirmed: true });
    setLocalLead((prev) =>
      prev && prev.id === currentLead.id
        ? ({ ...prev, meetingPresenceConfirmed: true } as Lead)
        : prev,
    );
    setMeetingPresenceConfirmSaving(true);

    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
        body: JSON.stringify({ meetingPresenceConfirmed: true }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível confirmar a agenda.");
      }

      patchLead?.(currentLead.id, {
        meetingPresenceConfirmed: true,
        meetingPresenceConfirmedAt:
          result.result?.meetingPresenceConfirmedAt ?? new Date().toISOString(),
      });
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id
          ? ({
              ...prev,
              meetingPresenceConfirmed: true,
              meetingPresenceConfirmedAt:
                result.result?.meetingPresenceConfirmedAt ?? new Date().toISOString(),
            } as Lead)
          : prev,
      );
      toast.success("Agenda confirmada com o lead");
    } catch (error) {
      patchLead?.(currentLead.id, { meetingPresenceConfirmed: previousPresenceConfirmed, meetingPresenceConfirmedAt: previousPresenceConfirmedAt });
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id
          ? ({
              ...prev,
              meetingPresenceConfirmed: previousPresenceConfirmed,
              meetingPresenceConfirmedAt: previousPresenceConfirmedAt,
            } as Lead)
          : prev,
      );
      toast.warning(error instanceof Error ? error.message : "Não foi possível confirmar a agenda.");
    } finally {
      setMeetingPresenceConfirmSaving(false);
    }
  };

  const onSubmit = async (data: LeadFormWithCustomFields, mode: LeadFormSaveMode = "full") => {
    const saveAsDraft = mode === "draft";
    const saveAssigneesOnly = mode === "assignees";
    if (!saveAssigneesOnly && leadCustomFieldDefinitions.length > 0 && data.customFields) {
      const customValidation = buildLeadCustomFieldsSchema(leadCustomFieldDefinitions).safeParse({
        customFields: data.customFields,
      });
      if (!customValidation.success) {
        toast.error(customValidation.error.issues[0]?.message || "Revise os campos personalizados");
        return;
      }
    }
    setIsSubmitting(true);

    try {
      if (currentLead) {
        setPendingSubmitData(null);
        if (saveAssigneesOnly) {
          const loadingToast = toast.loading("Salvando SDR e closer...");
          try {
            if (!supabaseId) {
              toast.error("Usuário não identificado", { id: loadingToast });
              return;
            }

            const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-supabase-user-id": supabaseId,
                "x-team-id": activeTeamId || "",
              },
              body: JSON.stringify({
                assignedTo: data.responsible || null,
                closerId: data.closerId || null,
              }),
            });

            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.isValid) {
              throw new Error(
                result?.errorMessages?.join(", ") || "Erro ao salvar SDR/closer do lead"
              );
            }

            const assigneesPatch =
              result.result && typeof result.result === "object"
                ? (result.result as Partial<Lead>)
                : {
                    assignedTo: data.responsible || null,
                    closerId: data.closerId || null,
                  };

            await applyLocalLeadPatch(currentLead.id, assigneesPatch);
            setLocalLead((prev) =>
              prev && prev.id === currentLead.id
                ? ({ ...prev, ...assigneesPatch } as Lead)
                : prev,
            );
            form.setValue("responsible", data.responsible || "", { shouldDirty: false });
            form.setValue("closerId", data.closerId || "", { shouldDirty: false });
            toast.success("SDR e closer salvos com sucesso!", {
              id: loadingToast,
              duration: 3000,
            });
          } catch (assigneesError) {
            toast.error(
              assigneesError instanceof Error
                ? assigneesError.message
                : "Erro ao salvar SDR/closer do lead",
              { id: loadingToast, duration: 5000 }
            );
          }
          return;
        }

        const loadingToast = toast.loading(
          saveAsDraft ? "Salvando rascunho..." : "Atualizando lead..."
        );

        const updateData = transformToUpdateRequest(data, saveAsDraft);
        const previousCloserId = currentLead.closerId ?? "";
        const nextCloserId = data.closerId ?? "";
        const closerChanged = nextCloserId !== previousCloserId;
        const hasScheduledMeeting =
          !!currentLead.meetingDate && currentLead.isTransfer !== true;
        const shouldRescheduleCloser =
          closerChanged &&
          hasScheduledMeeting &&
          !saveAsDraft &&
          (currentLead.status === "scheduled" || currentLead.status === "no_show");

        if (shouldRescheduleCloser) {
          if (!supabaseId) {
            toast.error("Usuário não identificado", { id: loadingToast });
            return;
          }

          const scheduleResponse = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}/schedule`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-supabase-user-id": supabaseId,
              "x-team-id": activeTeamId || "",
            },
            body: JSON.stringify({
              date: new Date(currentLead.meetingDate as string).toISOString(),
              meetingTitle: currentLead.meetingTitle || undefined,
              notes: currentLead.meetingNotes || undefined,
              meetingLink: currentLead.meetingLink || undefined,
              meetingType: currentLead.meetingType || undefined,
              closerId: nextCloserId || undefined,
              extraGuests: scheduleGuests.length ? scheduleGuests : undefined,
              transitionStatusToScheduled: false,
            }),
          });

          const scheduleResult = await scheduleResponse.json().catch(() => null);
          if (!scheduleResponse.ok || !scheduleResult?.isValid) {
            throw new Error(
              scheduleResult?.errorMessages?.join(", ") || "Erro ao reagendar closer da reunião"
            );
          }
        }

        const result = await updateLead(currentLead.id, updateData);

        if (result.success) {
          toast.success(
            saveAsDraft
              ? `Rascunho "${data.name}" salvo com sucesso!`
              : `Lead "${data.name}" atualizado com sucesso!`,
            {
            id: loadingToast,
            duration: 3000,
          });
          if (result.lead) {
            form.setValue("razaoSocial", result.lead.razaoSocial ?? "", { shouldDirty: false });
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
        const loadingToast = toast.loading(
          saveAsDraft ? `Salvando rascunho "${data.name}"...` : `Criando lead "${data.name}"...`
        );

        try {
          const createData = transformToCreateRequest(data, saveAsDraft);
          const result = await createLead(createData);

          if (result.requiresDuplicateConfirmation && result.duplicateCandidates?.length) {
            setPendingDuplicateCreate({ data: createData, saveAsDraft });
            setDuplicateCandidates(result.duplicateCandidates);
            setDuplicateDialogOpen(true);
            toast.dismiss(loadingToast);
            return;
          }

          if (result.success) {
            toast.success(
              saveAsDraft
                ? `Rascunho "${data.name}" salvo com sucesso!`
                : `Lead "${data.name}" criado com sucesso!`,
              {
              id: loadingToast,
              duration: 4000,
            });
            if (result.lead) {
              form.setValue("razaoSocial", result.lead.razaoSocial ?? "", { shouldDirty: false });
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

          if (errorMessage.includes("Unique constraint") || normalizedMessage.includes("já existe")) {
            toast.error("Aviso: já existe um lead com dados únicos em conflito (e-mail ou CNPJ)", {
              id: loadingToast,
              duration: 6000,
            });
          } else if (normalizedMessage.includes("validation") || normalizedMessage.includes("inválido")) {
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

        if (transition.blockerType === "closer_required") {
          setPendingCloserGate({
            status: newStatus,
            trigger: trigger ? { ...trigger } : undefined,
            currentCloserId: currentLead.closerId ?? null,
          });
          setCloserRequirementDialogOpen(true);
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
            email:
              typeof transition.currentLeadInfo?.email === "string"
                ? transition.currentLeadInfo.email
                : currentLead.email ?? null,
            phone:
              typeof transition.currentLeadInfo?.phone === "string"
                ? transition.currentLeadInfo.phone
                : currentLead.phone ?? null,
            cnpj:
              typeof transition.currentLeadInfo?.cnpj === "string"
                ? transition.currentLeadInfo.cnpj
                : currentLead.cnpj ?? null,
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

  const handleTransferToggle = async () => {
    if (!currentLead || !supabaseId || isTransferToggling) return;
    const next = !currentLead.isTransfer;
    const shouldClearCloser = next && !!currentLead.closerId;
    const previousCloserId = currentLead.closerId ?? null;
    const transferPatch: Partial<Lead> = {
      isTransfer: next,
      ...(shouldClearCloser ? { closerId: null, closer: undefined } : {}),
    };
    setIsTransferToggling(true);
    patchLead?.(currentLead.id, transferPatch);
    setLocalLead((prev) =>
      prev && prev.id === currentLead.id ? ({ ...prev, ...transferPatch } as Lead) : prev
    );
    if (shouldClearCloser) {
      form.setValue("closerId", "", { shouldDirty: false });
    }
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({
          isTransfer: next,
          ...(shouldClearCloser ? { closerId: null } : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível atualizar a transferência.");
      }
      const serverValue = result?.result?.isTransfer ?? next;
      const serverCloserId =
        shouldClearCloser ? null : (result?.result?.closerId ?? currentLead.closerId ?? null);
      const confirmedPatch: Partial<Lead> = {
        isTransfer: serverValue,
        ...(shouldClearCloser ? { closerId: null, closer: undefined } : { closerId: serverCloserId }),
      };
      patchLead?.(currentLead.id, confirmedPatch);
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...confirmedPatch } as Lead) : prev
      );
    } catch (error) {
      const rollbackPatch: Partial<Lead> = {
        isTransfer: !next,
        ...(shouldClearCloser && previousCloserId
          ? { closerId: previousCloserId }
          : {}),
      };
      patchLead?.(currentLead.id, rollbackPatch);
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...rollbackPatch } as Lead) : prev
      );
      if (shouldClearCloser && previousCloserId) {
        form.setValue("closerId", previousCloserId, { shouldDirty: false });
      }
      toast.warning(error instanceof Error ? error.message : "Não foi possível atualizar a transferência.");
    } finally {
      setIsTransferToggling(false);
    }
  };

  const handleShareSchedule = async () => {
    if (!currentLead || !supabaseId) return;
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}/schedule/share`, {
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
      setScheduleShareUrl(result.result.publicUrl as string);
      setScheduleShareExpiresAt(result.result.expiresAt as string | null);
      setScheduleShareDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link de compartilhamento.");
    }
  };

  const handleSalesInfoRequirementSave = async (payload: SalesInfoPayload) => {
    if (!currentLead || !supabaseId || !pendingSalesInfoGate) return;

    setSalesInfoSaving(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
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

  const handleCloserRequirementSave = async (payload: CloserRequirementPayload) => {
    if (!currentLead || !supabaseId || !pendingCloserGate) return;

    setCloserRequirementSaving(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify({ closerId: payload.closerId }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao salvar closer do lead");
      }

      const closerPatch =
        result.result && typeof result.result === "object"
          ? (result.result as Partial<Lead>)
          : {};
      await applyLocalLeadPatch(currentLead.id, closerPatch);
      setLocalLead((prev) =>
        prev && prev.id === currentLead.id ? ({ ...prev, ...closerPatch } as Lead) : prev,
      );

      const updated = await updateLeadStatus(
        pendingCloserGate.status,
        pendingCloserGate.trigger,
        false
      );
      if (!updated) return;

      setCloserRequirementDialogOpen(false);
      setPendingCloserGate(null);
      setStatusDialogOpen(false);
      setShowStatusTriggerDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar closer do lead");
    } finally {
      setCloserRequirementSaving(false);
    }
  };

  const handleScheduleStatusSuccess = async (payload?: ScheduleMeetingSuccessPayload) => {
    if (!currentLead || !payload) return;

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
            ...(payload.closerId ? {} : { closer: undefined }),
          } as Lead)
        : prev,
    );

    const refreshedDetails = await refreshLeadDetails({ silent: true });
    if (refreshedDetails?.lead && refreshedDetails.lead.id === payload.leadId) {
      setLocalLead((prev) =>
        prev && prev.id === payload.leadId
          ? ({
              ...prev,
              ...refreshedDetails.lead,
              isTransfer: prev.isTransfer,
            } as Lead)
          : prev,
      );
    }
  };

  const handleLeadInfoRequirementSave = async (payload: LeadInfoPayload) => {
    if (!currentLead || !supabaseId || !pendingLeadInfoGate) return;

    setLeadInfoSaving(true);
    try {
      const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
        },
        body: JSON.stringify(mapLeadInfoPayloadForUpdate(payload)),
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
        razaoSocial: currentLead.razaoSocial ?? "",
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
        isTransfer: currentLead.isTransfer === true,
        extraGuests: "",
        responsible: currentLead.assignedTo || "",
        ticket: currentLead.ticket ? formatCurrency(currentLead.ticket) : "",
        contractDueDate: currentLead.contractDueDate || "",
        soldPlan: currentLead.soldPlan || undefined,
        isReferral: currentLead.isReferral || false,
        referrerLeadId: currentLead.referrerLeadId || "",
        referrerName: currentLead.referrerName || "",
        referrerPhone: currentLead.referrerPhone || "",
        customFields: Object.fromEntries(
          (currentLead.customFields ?? []).map((field) => [field.key, field.value])
        ),
      });
    } else if (!currentLead && open) {
      form.reset({
        name: "",
        phone: "",
        email: "",
        cnpj: "",
        razaoSocial: "",
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
        isTransfer: false,
        extraGuests: "",
        responsible: "",
        ticket: "",
        contractDueDate: "",
        soldPlan: undefined,
        isReferral: false,
        referrerLeadId: "",
        referrerName: "",
        referrerPhone: "",
        customFields: {},
      });
    }
  }, [currentLead, open, form]);

  useEffect(() => {
    if (!open) return;
    refreshLeadCustomFieldDefinitions();
  }, [open, customFieldsTeamId, refreshLeadCustomFieldDefinitions]);

  useEffect(() => {
    if (!open || leadCustomFieldDefinitions.length === 0) return;

    const leadCustomFields =
      leadDetails?.lead?.customFields ?? currentLead?.customFields ?? [];
    const fromLead = Object.fromEntries(
      leadCustomFields.map((field) => [field.key, field.value])
    );
    const merged: Record<string, unknown> = { ...fromLead };

    for (const definition of leadCustomFieldDefinitions) {
      if (!(definition.key in merged)) {
        if (definition.type === "boolean") {
          merged[definition.key] = false;
        } else if (definition.type === "multi_select") {
          merged[definition.key] = [];
        } else {
          merged[definition.key] = "";
        }
      }
    }

    form.setValue("customFields", merged, { shouldDirty: false, shouldValidate: false });
  }, [
    open,
    currentLead?.id,
    currentLead?.customFields,
    leadDetails?.lead?.customFields,
    leadCustomFieldDefinitions,
    form,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchScheduleGuests = async () => {
      if (!currentLead || !open) {
        setScheduleGuests([]);
        return;
      }
      if (leadDetailsLoading) return;
      if (!supabaseId) return;
      if (!currentLead.id) {
        setScheduleGuests([]);
        return;
      }
      if (!currentLead.meetingDate && !currentLead.meetingTitle && !currentLead.meetingLink) {
        setScheduleGuests([]);
        return;
      }
      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${currentLead.id}/schedule`, {
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
      }
    };

    fetchScheduleGuests();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [currentLead?.id, open, supabaseId, activeTeamId, form, patchLead, leadDetailsLoading, currentLead?.meetingDate, currentLead?.meetingTitle, currentLead?.meetingLink]);

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
                    {currentLead && isDraftLead(currentLead) ? (
                      <div className="mt-3 flex flex-col gap-2 rounded-md bg-muted px-3 py-2">
                        <DraftLeadIndicator />
                        <p className="text-sm text-muted-foreground">
                          Este lead ainda é um rascunho. Use Salvar para entrar no funil.
                        </p>
                      </div>
                    ) : null}
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
                    {currentLead && !leadDetailsLoading && currentLead.isTransfer === true && currentLead.status === "new_opportunity" && canTransferBetweenTeams && hasTransferTargets && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setShowTransferBetweenTeamsDialog(true)}
                              className="h-9 w-9"
                              aria-label="Transferir lead entre times"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Transferir entre times</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {currentLead && !leadDetailsLoading && hasTransferTargets && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant={currentLead.isTransfer ? "default" : "outline"}
                              onClick={() => void handleTransferToggle()}
                              disabled={isTransferToggling}
                            >
                              {currentLead.isTransfer ? "Transferência ativa" : "Ativar transferência"}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {currentLead.isTransfer
                              ? "Clique para desativar a transferência"
                              : "Clique para marcar como lead para transferência"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canMergeLead && currentLead && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setMergeDialogOpen(true)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Mesclar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mesclar com outro lead</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
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
                  <Tabs
                    value={leftPanelTab}
                    onValueChange={(value) => setLeftPanelTab(value as LeadDialogLeftTab)}
                    className="flex h-full min-h-0 flex-col gap-3"
                  >
                    <TabsList className={currentLead ? "grid w-full grid-cols-4" : "grid w-full grid-cols-1"}>
                      <TabsTrigger value="dados">Dados</TabsTrigger>
                      {currentLead ? (
                        <>
                          <TabsTrigger value="tags">Tags</TabsTrigger>
                          <TabsTrigger value="contatos">Contatos</TabsTrigger>
                          <TabsTrigger value="documentos">Documentos</TabsTrigger>
                        </>
                      ) : null}
                    </TabsList>

                    <TabsContent value="dados" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                      <LeadForm
                        form={form}
                        onSubmit={onSubmit}
                        isLoading={isSubmitting}
                        customFieldDefinitions={leadCustomFieldDefinitions}
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
                                closerName: scheduleCloserName,
                                meetingTitle: currentLead.meetingTitle,
                                meetingNotes: currentLead.meetingNotes,
                                meetingLink: currentLead.meetingLink,
                                meetingHeald: currentLead.meetingHeald,
                                meetingPresenceConfirmed: currentLead.meetingPresenceConfirmed === true,
                                isPreSchedule: currentLead.isTransfer === true,
                              }
                            : undefined
                        }
                        onManageSchedule={currentLead ? () => setShowScheduleDialog(true) : undefined}
                        onResendScheduleInvite={
                          currentLead?.meetingDate && currentLead.status === "scheduled" && currentLead.isTransfer !== true
                            ? () => setResendDialogOpen(true)
                            : undefined
                        }
                        onShareSchedule={
                          currentLead?.meetingDate && currentLead.isTransfer !== true
                            ? () => void handleShareSchedule()
                            : undefined
                        }
                        canToggleMeetingHeald={canEditMeetingHeald}
                        meetingHealdSaving={meetingHealdSaving}
                        onMeetingHealdChange={canEditMeetingHeald ? handleMeetingHealdChange : undefined}
                        canConfirmMeetingPresence={canEditMeetingPresence}
                        meetingPresenceConfirmSaving={meetingPresenceConfirmSaving}
                        onMeetingPresenceConfirm={
                          canEditMeetingPresence ? handleMeetingPresenceConfirm : undefined
                        }
                        canMarkNoShow={canMarkNoShow}
                        onMarkNoShow={handleNoShow}
                        isEditMode={!!currentLead}
                        currentProfileId={user.id}
                        currentUserIsSdr={isOperatorSdr}
                        currentUserIsCloser={isCloserOperator}
                        isCloserSelectDisabled={isCloserOperator}
                        supabaseId={supabaseId}
                        activeTeamId={activeTeamId ?? undefined}
                      />
                    </TabsContent>

                    {currentLead && activeTeamId && supabaseId ? (
                      <>
                        <TabsContent value="tags" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                          <LeadTagsTab
                            leadId={currentLead.id}
                            teamId={activeTeamId}
                            supabaseId={supabaseId}
                          />
                        </TabsContent>
                        <TabsContent value="contatos" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                          <LeadContactsTab
                            leadId={currentLead.id}
                            teamId={activeTeamId}
                            supabaseId={supabaseId}
                          />
                        </TabsContent>
                        <TabsContent value="documentos" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                          <LeadDocumentRequestsTab
                            leadId={currentLead.id}
                            teamId={activeTeamId}
                            supabaseId={supabaseId}
                          />
                        </TabsContent>
                      </>
                    ) : null}
                  </Tabs>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm flex flex-col min-h-0 lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] lg:h-[95%] lg:max-h-[95%] lg:self-center">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Informações do lead</h3>
                <DialogClose asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
              <Tabs value={sidePanelTab} onValueChange={(value) => setSidePanelTab(value as "activities" | "forms")} className="mt-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="activities">Atividades</TabsTrigger>
                  <TabsTrigger value="forms">Formulários</TabsTrigger>
                </TabsList>
              </Tabs>

              {sidePanelTab === "forms" ? (
                currentLead && activeTeamId ? (
                  <LeadPublicFormResponses leadId={currentLead.id} teamId={activeTeamId} supabaseId={supabaseId ?? ""} />
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Respostas disponíveis após criar o lead.</div>
                )
              ) : (
              <>

              {currentLead && activeTeamId && hasAccess(FEATURE_SLUGS.WHATSAPP) && (
                <LeadWhatsAppCard
                  leadId={currentLead.id}
                  supabaseId={supabaseId ?? ''}
                  teamId={activeTeamId}
                  enabled={!isLeadContentLoading}
                />
              )}

              {currentLead && activeTeamId && hasAccess(FEATURE_SLUGS.RADAR) && (
                <LeadRadarTemperatureCard
                  leadId={currentLead.id}
                  supabaseId={supabaseId ?? ""}
                  teamId={activeTeamId}
                  enabled={open && !isLeadContentLoading}
                />
              )}

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
                  <LeadActivityTimeline
                    activities={mergedActivities}
                    supabaseId={supabaseId ?? ""}
                    scheduleTimezone={scheduleTimezone}
                    highlightedActivityId={highlightedActivityId}
                    activityItemRefs={activityItemRefs}
                    canReactToActivity={canReactToActivity}
                    reactionPickerOpenId={reactionPickerOpenId}
                    onReactionPickerOpenChange={setReactionPickerOpenId}
                    onToggleReaction={handleToggleReaction}
                    getReactionsForActivity={getReactionsForActivity}
                    mentionRegex={mentionRegex}
                  />
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

              </>
              )}

              {currentLead && supabaseId && activeTeamId && (
                <TaskFormDialog
                  open={taskDialogOpen}
                  onOpenChange={setTaskDialogOpen}
                  leadId={currentLead.id}
                  leadName={currentLead.name}
                  teamMembers={usersToAssign}
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

      {currentLead && supabaseId && (
        <ResendScheduleInviteDialog
          open={resendDialogOpen}
          onOpenChange={setResendDialogOpen}
          leadId={currentLead.id}
          supabaseId={supabaseId}
          teamId={activeTeamId}
          participants={{
            leadEmail: currentLead.email,
            leadName: currentLead.name,
            closerEmail: currentLead.closer?.email,
            closerName: currentLead.closer?.fullName ?? undefined,
            assigneeEmail: currentLead.assignee?.email,
            assigneeName: currentLead.assignee?.fullName ?? undefined,
          }}
        />
      )}

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
          initialHolderRazaoSocial={currentLead.razaoSocial}
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
          onResendScheduleInvite={() => setResendDialogOpen(true)}
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
        <CloserRequirementDialog
          open={closerRequirementDialogOpen}
          onOpenChange={(nextOpen) => {
            setCloserRequirementDialogOpen(nextOpen);
            if (!nextOpen) {
              setPendingCloserGate(null);
            }
          }}
          onSave={handleCloserRequirementSave}
          closers={availableScheduleClosers}
          closersLoading={leadDetailsLoading}
          closersError={leadDetailsError}
          leadName={currentLead.name}
          isSaving={closerRequirementSaving}
          initialCloserId={pendingCloserGate?.currentCloserId}
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
                disabled={!displayShareUrl}
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
                disabled={!displayShareUrl}
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
                disabled={!displayShareUrl}
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
                <Input value={displayShareUrl} readOnly />
                <Button type="button" variant="secondary" onClick={handleCopyShareLink} disabled={!displayShareUrl}>
                  <CopyIcon size={16} />
                  Copiar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {currentLead && (
        <TransferBetweenTeamsDialog
          open={showTransferBetweenTeamsDialog}
          onOpenChange={setShowTransferBetweenTeamsDialog}
          lead={currentLead}
          allowedTeamIds={allowedTransferTargetIds}
          onSuccess={async (updatedLead) => {
            await applyLocalLeadPatch(updatedLead.id, updatedLead);
            await refreshLeads();
            setOpen(false);
          }}
        />
      )}

      {currentLead && activeTeamId && supabaseId && (
        <LeadMergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          targetLead={currentLead}
          supabaseId={supabaseId}
          teamId={activeTeamId}
          onMerged={async () => {
            await refreshLeads();
            setOpen(false);
          }}
        />
      )}

      <LeadDuplicateWarningDialog
        open={duplicateDialogOpen}
        onOpenChange={(nextOpen) => {
          setDuplicateDialogOpen(nextOpen);
          if (!nextOpen) {
            setPendingDuplicateCreate(null);
            setDuplicateCandidates([]);
          }
        }}
        candidates={duplicateCandidates}
        isConfirming={duplicateConfirming}
        onConfirm={() => void handleConfirmDuplicateCreate()}
      />

      <Dialog open={scheduleShareDialogOpen} onOpenChange={setScheduleShareDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Link público do agendamento</DialogTitle>
            <DialogDescription>
              Compartilhe este link para que o participante acesse a reunião.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {scheduleShareExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Expira em {new Date(scheduleShareExpiresAt).toLocaleString("pt-BR")}
              </p>
            )}
            <div className="grid gap-2">
              <Label>Link público</Label>
              <div className="flex items-center gap-2">
                <Input value={scheduleShareUrl} readOnly />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(scheduleShareUrl).then(() =>
                      toast.success("Link copiado.")
                    );
                  }}
                  disabled={!scheduleShareUrl}
                >
                  <CopyIcon size={16} />
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

    </>
  );
}
