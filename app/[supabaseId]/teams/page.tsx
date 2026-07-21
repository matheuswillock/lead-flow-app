"use client";

import * as React from "react";
import { useState } from "react";
import { useParams } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { toast } from "sonner";
import { Check, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUser } from "@/app/context/UserContext";
import { useBillingSlots } from "@/app/hooks/useBillingSlots";
import { cn } from "@/lib/utils";
import { ManagerTeamsContainer } from "./features/container/ManagerTeamsContainer";
import { TeamLeadCustomFieldsSection } from "./features/components/TeamLeadCustomFieldsSection";
import { PendingPaymentEditDialog } from "./features/container/PendingPaymentEditDialog";
import { ExternalMemberInviteForm } from "./features/components/ExternalMemberInviteForm";
import type { ManagerTeamTableRow } from "./features/types";

type TeamMember = {
  id: string;
  profileId: string;
  name: string;
  email: string;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  profileIconUrl: string | null;
  isMaster: boolean;
};

type EligibleProfile = {
  id: string;
  name: string;
  email: string;
};

type TeamTransferTarget = {
  teamId: string;
  teamName: string;
};

const STATUS_OPTIONS = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
  { value: "future_sale", label: "Venda Futura" },
  { value: "offerNegotiation", label: "Negociação" },
  { value: "pending_documents", label: "Documentos pendentes" },
  { value: "offerSubmission", label: "Proposta" },
  { value: "dps_agreement", label: "DPS | Contrato" },
  { value: "invoicePayment", label: "Boleto" },
  { value: "disqualified", label: "Desqualificado" },
  { value: "opportunityLost", label: "Perdido" },
  { value: "operator_denied", label: "Negado operadora" },
  { value: "contract_finalized", label: "Negócio fechado" },
] as const;

type LeadTimeRuleDraft = {
  leadTimeValue: string;
  leadTimeUnit: "hours" | "days";
};

type CombinedRuleDraft = {
  id: string;
  targetStatus: string;
  requiredStatus: string;
  requireConfirmation: boolean;
  confirmationMessage: string;
  isEnabled: boolean;
};

type StatusOptionValue = (typeof STATUS_OPTIONS)[number]["value"];

type TeamStatusRulesSnapshot = {
  disabledStatuses: string[];
  leadTimeRules: Array<{
    status: string;
    leadTimeValue: number;
    leadTimeUnit: "hours" | "days";
  }>;
  combinedRules: Array<{
    targetStatus: string;
    requiredStatus: string;
    requireConfirmation: boolean;
    confirmationMessage: string | null;
    isEnabled: boolean;
  }>;
};

const buildTeamStatusRulesSnapshot = (input: {
  disabledStatuses: string[];
  leadTimeRules: Record<string, LeadTimeRuleDraft>;
  combinedRules: CombinedRuleDraft[];
}): TeamStatusRulesSnapshot => {
  const disabledStatuses = Array.from(new Set(input.disabledStatuses || [])).sort((a, b) =>
    a.localeCompare(b)
  );

  const leadTimeRules = Object.entries(input.leadTimeRules || {})
    .map(([status, value]) => {
      const leadTimeUnit: "hours" | "days" = value.leadTimeUnit === "days" ? "days" : "hours";
      return {
        status,
        leadTimeValue: Number(value.leadTimeValue),
        leadTimeUnit,
      };
    })
    .filter((rule) => Number.isFinite(rule.leadTimeValue) && rule.leadTimeValue > 0)
    .sort((a, b) => a.status.localeCompare(b.status));

  const combinedRules = (input.combinedRules || [])
    .map((rule) => ({
      targetStatus: rule.targetStatus,
      requiredStatus: rule.requiredStatus,
      requireConfirmation: rule.requireConfirmation === true,
      confirmationMessage: rule.confirmationMessage?.trim() || null,
      isEnabled: rule.isEnabled !== false,
    }))
    .filter((rule) => rule.targetStatus && rule.requiredStatus)
    .sort((a, b) => {
      const keyA = `${a.targetStatus}|${a.requiredStatus}|${a.requireConfirmation ? "1" : "0"}|${a.confirmationMessage || ""}|${a.isEnabled ? "1" : "0"}`;
      const keyB = `${b.targetStatus}|${b.requiredStatus}|${b.requireConfirmation ? "1" : "0"}|${b.confirmationMessage || ""}|${b.isEnabled ? "1" : "0"}`;
      return keyA.localeCompare(keyB);
    });

  return {
    disabledStatuses,
    leadTimeRules,
    combinedRules,
  };
};

export default function TeamsPage() {
  const { user } = useUser();
  const { teams, activeTeamId, activeRole, activeTeam, setActiveTeamId, refreshTeams, isLoading: teamsLoading, error: teamsError } = useTeamContext();
  const [switchingTeamId, setSwitchingTeamId] = useState<string | null>(null);
  const [settingDefaultTeamId, setSettingDefaultTeamId] = useState<string | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createTeamBillingType, setCreateTeamBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageTeamId, setManageTeamId] = useState<string | null>(null);
  const [manageTeamName, setManageTeamName] = useState("");
  const [manageLoading, setManageLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [eligibleProfiles, setEligibleProfiles] = useState<EligibleProfile[]>([]);
  const [transferCandidates, setTransferCandidates] = useState<EligibleProfile[]>([]);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [isAddMemberDropdownOpen, setIsAddMemberDropdownOpen] = useState(false);
  const [highlightedEligibleProfileIndex, setHighlightedEligibleProfileIndex] = useState(-1);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"delete" | "transfer" | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [transferCandidateId, setTransferCandidateId] = useState("");
  const [transferTargets, setTransferTargets] = useState<TeamTransferTarget[]>([]);
  const [canManageTransferRoutes, setCanManageTransferRoutes] = useState(false);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [savingTransferTargets, setSavingTransferTargets] = useState(false);
  const [disabledStatuses, setDisabledStatuses] = useState<string[]>([]);
  const [leadTimeRules, setLeadTimeRules] = useState<Record<string, LeadTimeRuleDraft>>({});
  const [combinedRules, setCombinedRules] = useState<CombinedRuleDraft[]>([]);
  const [initialRulesSnapshot, setInitialRulesSnapshot] = useState<TeamStatusRulesSnapshot | null>(
    null
  );
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [cancelingPendingTeamId, setCancelingPendingTeamId] = useState<string | null>(null);
  const [isEditPendingPaymentOpen, setIsEditPendingPaymentOpen] = useState(false);
  const [pendingPaymentLoading, setPendingPaymentLoading] = useState(false);
  const [pendingPaymentSubmitting, setPendingPaymentSubmitting] = useState(false);
  const [pendingPaymentBillingType, setPendingPaymentBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [pendingPaymentTarget, setPendingPaymentTarget] = useState<ManagerTeamTableRow | null>(null);
  const [pendingPaymentSummary, setPendingPaymentSummary] = useState({
    addonLabel: "",
    addonDetail: "",
    totalCharge: 0,
    remainingMonths: 1,
  });
  const addMemberFieldRef = React.useRef<HTMLDivElement | null>(null);
  const addMemberOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const canManageTeams = !!(user?.isMaster || (activeRole === "manager" && activeTeam?.canManageAccountTeams));
  const managedTeam = React.useMemo(
    () => teams.find((team) => team.id === manageTeamId) ?? null,
    [teams, manageTeamId]
  );
  const isManagedTeamDefault = managedTeam?.isDefault === true;
  const isSettingManagedTeamDefault = settingDefaultTeamId === manageTeamId;
  const defaultTeamToggleDisabled =
    !canManageTeams ||
    !manageTeamId ||
    managedTeam?.isAssociateAccount === true ||
    managedTeam?.isPending === true ||
    isManagedTeamDefault ||
    isSettingManagedTeamDefault;
  const { hasAvailableTeamSlot } = useBillingSlots(supabaseId, !!user?.isMaster);
  const isOnlyMasterTeam = user?.id
    ? teams.filter((team) => team.masterId === user.id).length <= 1
    : false;
  const selectedEligibleProfile = eligibleProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const filteredEligibleProfiles = eligibleProfiles.filter((profile) => {
    const normalizedQuery = addMemberQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return (
      profile.name.toLowerCase().includes(normalizedQuery) ||
      profile.email.toLowerCase().includes(normalizedQuery)
    );
  });
  const currentRulesSnapshot = React.useMemo(
    () => buildTeamStatusRulesSnapshot({ disabledStatuses, leadTimeRules, combinedRules }),
    [disabledStatuses, leadTimeRules, combinedRules]
  );
  const hasRulesChanges = React.useMemo(() => {
    if (!initialRulesSnapshot) return false;
    return JSON.stringify(currentRulesSnapshot) !== JSON.stringify(initialRulesSnapshot);
  }, [currentRulesSnapshot, initialRulesSnapshot]);

  React.useEffect(() => {
    if (!isAddMemberDropdownOpen) return;

    const handlePointerOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!addMemberFieldRef.current?.contains(target)) {
        setIsAddMemberDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerOutside);
    document.addEventListener("touchstart", handlePointerOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerOutside);
      document.removeEventListener("touchstart", handlePointerOutside);
    };
  }, [isAddMemberDropdownOpen]);

  React.useEffect(() => {
    if (!isAddMemberDropdownOpen) {
      setHighlightedEligibleProfileIndex(-1);
      return;
    }

    if (filteredEligibleProfiles.length === 0) {
      setHighlightedEligibleProfileIndex(-1);
      return;
    }

    setHighlightedEligibleProfileIndex((currentIndex) => {
      if (currentIndex < 0 || currentIndex >= filteredEligibleProfiles.length) {
        return 0;
      }
      return currentIndex;
    });
  }, [isAddMemberDropdownOpen, filteredEligibleProfiles.length]);

  React.useEffect(() => {
    if (!isAddMemberDropdownOpen || highlightedEligibleProfileIndex < 0) return;
    addMemberOptionRefs.current[highlightedEligibleProfileIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedEligibleProfileIndex, isAddMemberDropdownOpen]);

  React.useEffect(() => {
    const hasPendingTeamPayment = teams.some((team) => {
      const status = (team.pendingPayment?.paymentStatus ?? "").toUpperCase();
      return status === "PENDING" || status === "FAILED";
    });

    if (!hasPendingTeamPayment) return;

    const intervalId = setInterval(() => {
      void refreshTeams();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [teams, refreshTeams]);

  const handleSetActiveTeam = async (teamId: string) => {
    if (!teamId || teamId === activeTeamId) {
      return;
    }

    setSwitchingTeamId(teamId);
    try {
      await setActiveTeamId(teamId);
      toast.success("Time ativo atualizado.");
    } catch (error) {
      console.error("Erro ao atualizar time ativo:", error);
      toast.error("Não foi possível atualizar o time ativo.");
    } finally {
      setSwitchingTeamId(null);
    }
  };

  const handleSetDefaultTeam = async (teamId: string) => {
    setSettingDefaultTeamId(teamId);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
        body: JSON.stringify({ isDefault: true }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível definir o time padrão.");
      }
      toast.success("Time padrão atualizado.");
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao definir time padrão:", error);
      toast.error(error?.message || "Erro ao definir time padrão.");
    } finally {
      setSettingDefaultTeamId(null);
    }
  };

  const handleCreateTeam = async () => {
    const trimmedName = newTeamName.trim();
    if (!trimmedName) {
      toast.error("Informe um nome para o time.");
      return;
    }

    setIsCreatingTeam(true);
    try {
      const response = await fetch("/api/v1/teams/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ name: trimmedName, billingType: createTeamBillingType }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível criar o time.");
      }

      const payload = result?.result as any;

      if (payload?.created === true) {
        toast.success("Time criado com sucesso!");
        setIsCreateTeamOpen(false);
        setNewTeamName("");
        await refreshTeams();
        return;
      }

      if (payload?.checkoutUrl) {
        toast.success("Checkout gerado com sucesso!");
        if (user?.isMaster) {
          window.open(payload.checkoutUrl as string, "_blank", "noopener,noreferrer");
        } else {
          toast.message("O master recebeu o e-mail com o link de pagamento.");
        }
        setIsCreateTeamOpen(false);
        setNewTeamName("");
        return;
      }

      toast.success("Solicitação processada com sucesso!");
      setIsCreateTeamOpen(false);
      setNewTeamName("");
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao criar time:", error);
      toast.error(error?.message || "Erro ao criar time.");
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleViewPendingCheckout = (team: ManagerTeamTableRow) => {
    const checkoutUrl = team.pendingPayment?.checkoutUrl;
    if (!checkoutUrl) {
      toast.error("Checkout indisponível para este pagamento.");
      return;
    }
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenEditPendingPayment = async (team: ManagerTeamTableRow) => {
    const pendingActionId = team.pendingPayment?.id;
    if (!pendingActionId) {
      toast.error("Pagamento pendente não encontrado.");
      return;
    }

    setPendingPaymentTarget(team);
    setIsEditPendingPaymentOpen(true);
    setPendingPaymentLoading(true);

    try {
      const response = await fetch(`/api/v1/addon-checkout/${pendingActionId}`);
      const result = await response.json();
      if (!response.ok || !result?.isValid || !result?.result) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao carregar pagamento pendente.");
      }
      const details = result.result as any;
      setPendingPaymentBillingType(details.presetBillingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX");
      setPendingPaymentSummary({
        addonLabel: details.addonLabel ?? "Time adicional",
        addonDetail: details.addonDetail ?? team.name,
        totalCharge: Number(details.pricing?.totalCharge ?? 0),
        remainingMonths: Number(details.pricing?.remainingMonths ?? 1),
      });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar pagamento pendente.");
      setIsEditPendingPaymentOpen(false);
      setPendingPaymentTarget(null);
    } finally {
      setPendingPaymentLoading(false);
    }
  };

  const handleCancelPendingTeam = async (team: ManagerTeamTableRow) => {
    const pendingActionId = team.pendingPayment?.id;
    if (!pendingActionId) return;

    setCancelingPendingTeamId(team.id);
    try {
      const response = await fetch(`/api/v1/teams/pending-actions/${pendingActionId}`, {
        method: "DELETE",
        headers: { "x-supabase-user-id": supabaseId },
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao cancelar criação do time.");
      }
      toast.success("Criação do time cancelada com sucesso.");
      await refreshTeams();
    } catch (error: any) {
      Sentry.captureException(error);
      toast.error(error?.message || "Erro ao cancelar criação do time.");
    } finally {
      setCancelingPendingTeamId(null);
    }
  };

  const handleSubmitEditPendingPayment = async () => {
    const pendingActionId = pendingPaymentTarget?.pendingPayment?.id;
    if (!pendingActionId) return;

    setPendingPaymentSubmitting(true);
    try {
      const response = await fetch(`/api/v1/addon-checkout/${pendingActionId}/billing-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingType: pendingPaymentBillingType }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao atualizar forma de pagamento.");
      }

      toast.success("Forma de pagamento atualizada.");
      setIsEditPendingPaymentOpen(false);
      setPendingPaymentTarget(null);
      await refreshTeams();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar forma de pagamento.");
    } finally {
      setPendingPaymentSubmitting(false);
    }
  };

  const loadTeamStatusRules = async (teamId: string) => {
    if (!teamId) return;
    setRulesLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/status-rules`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        setDisabledStatuses([]);
        setLeadTimeRules({});
        setCombinedRules([]);
        setInitialRulesSnapshot(
          buildTeamStatusRulesSnapshot({
            disabledStatuses: [],
            leadTimeRules: {},
            combinedRules: [],
          })
        );
        return;
      }

      const payload = result.result as {
        disabledStatuses?: string[];
        leadTimeRules?: Array<{ status: string; leadTimeValue: number; leadTimeUnit: "hours" | "days" }>;
        combinedRules?: Array<{
          id: string;
          targetStatus: string;
          requiredStatus: string;
          requireConfirmation: boolean;
          confirmationMessage: string | null;
          isEnabled: boolean;
        }>;
      };

      const nextDisabledStatuses = payload.disabledStatuses || [];
      const nextLeadTimeRules: Record<string, LeadTimeRuleDraft> = {};
      (payload.leadTimeRules || []).forEach((rule) => {
        nextLeadTimeRules[rule.status] = {
          leadTimeValue: String(rule.leadTimeValue || ""),
          leadTimeUnit: rule.leadTimeUnit === "days" ? "days" : "hours",
        };
      });
      const nextCombinedRules = (payload.combinedRules || []).map((rule) => ({
        id: rule.id,
        targetStatus: rule.targetStatus,
        requiredStatus: rule.requiredStatus,
        requireConfirmation: rule.requireConfirmation,
        confirmationMessage: rule.confirmationMessage || "",
        isEnabled: rule.isEnabled,
      }));

      setDisabledStatuses(nextDisabledStatuses);
      setLeadTimeRules(nextLeadTimeRules);
      setCombinedRules(nextCombinedRules);
      setInitialRulesSnapshot(
        buildTeamStatusRulesSnapshot({
          disabledStatuses: nextDisabledStatuses,
          leadTimeRules: nextLeadTimeRules,
          combinedRules: nextCombinedRules,
        })
      );
    } catch (error) {
      console.error("Erro ao carregar regras do time:", error);
      setDisabledStatuses([]);
      setLeadTimeRules({});
      setCombinedRules([]);
      setInitialRulesSnapshot(
        buildTeamStatusRulesSnapshot({
          disabledStatuses: [],
          leadTimeRules: {},
          combinedRules: [],
        })
      );
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSaveTeamStatusRules = async () => {
    if (!manageTeamId) return;
    setRulesSaving(true);
    try {
      const leadTimePayload = Object.entries(leadTimeRules)
        .map(([status, value]) => ({
          status,
          leadTimeValue: Number(value.leadTimeValue),
          leadTimeUnit: value.leadTimeUnit,
        }))
        .filter((rule) => Number.isFinite(rule.leadTimeValue) && rule.leadTimeValue > 0);

      const combinedRulesPayload = combinedRules
        .map((rule) => ({
          targetStatus: rule.targetStatus,
          requiredStatus: rule.requiredStatus,
          requireConfirmation: rule.requireConfirmation,
          confirmationMessage: rule.confirmationMessage || null,
          isEnabled: rule.isEnabled,
        }))
        .filter((rule) => rule.targetStatus && rule.requiredStatus);

      const response = await fetch(`/api/v1/teams/${manageTeamId}/status-rules`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": manageTeamId,
        },
        body: JSON.stringify({
          disabledStatuses,
          leadTimeRules: leadTimePayload,
          combinedRules: combinedRulesPayload,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível salvar as regras.");
      }
      toast.success("Regras do time salvas com sucesso.");
      await loadTeamStatusRules(manageTeamId);
    } catch (error: any) {
      console.error("Erro ao salvar regras:", error);
      toast.error(error?.message || "Erro ao salvar regras.");
    } finally {
      setRulesSaving(false);
    }
  };

  const handleToggleDisabledStatus = (status: StatusOptionValue, checked: boolean) => {
    setDisabledStatuses((prev) => {
      if (checked) {
        return prev.includes(status) ? prev : [...prev, status];
      }
      return prev.filter((item) => item !== status);
    });
  };

  const handleLeadTimeEnabled = (status: StatusOptionValue, enabled: boolean) => {
    setLeadTimeRules((prev) => {
      if (!enabled) {
        const next = { ...prev };
        delete next[status];
        return next;
      }
      return {
        ...prev,
        [status]: prev[status] || {
          leadTimeValue: "",
          leadTimeUnit: "hours",
        },
      };
    });
  };

  const handleLeadTimeFieldChange = (
    status: StatusOptionValue,
    field: keyof LeadTimeRuleDraft,
    value: string
  ) => {
    setLeadTimeRules((prev) => ({
      ...prev,
      [status]: {
        leadTimeValue: prev[status]?.leadTimeValue ?? "",
        leadTimeUnit: prev[status]?.leadTimeUnit ?? "hours",
        [field]: value,
      },
    }));
  };

  const handleAddCombinedRule = () => {
    const defaultTarget = "invoicePayment";
    const defaultRequired = "dps_agreement";
    setCombinedRules((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        targetStatus: defaultTarget,
        requiredStatus: defaultRequired,
        requireConfirmation: false,
        confirmationMessage: "",
        isEnabled: true,
      },
    ]);
  };

  const handleUpdateCombinedRule = (id: string, patch: Partial<CombinedRuleDraft>) => {
    setCombinedRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const handleRemoveCombinedRule = (id: string) => {
    setCombinedRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const loadManageData = async (teamId: string) => {
    if (!teamId) return;
    setManageLoading(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/members`, {
        headers: {
          "x-supabase-user-id": supabaseId,
          "x-team-id": teamId,
        },
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível carregar o time.");
      }

      const payload = result.result as {
        team: { id: string; name: string };
        members: TeamMember[];
        eligibleProfiles: EligibleProfile[];
        transferCandidates: EligibleProfile[];
        transferTargets?: TeamTransferTarget[];
        canManageTransferRoutes?: boolean;
        canManageMembers?: boolean;
      };

      setMembers(payload.members || []);
      setEligibleProfiles(payload.eligibleProfiles || []);
      setTransferCandidates(payload.transferCandidates || []);
      setTransferTargets(payload.transferTargets || []);
      setCanManageTransferRoutes(payload.canManageTransferRoutes === true);
      setCanManageMembers(payload.canManageMembers === true);
      setRenameValue(payload.team.name || "");
      setManageTeamName(payload.team.name || "");
      if (payload.transferCandidates?.length) {
        setTransferCandidateId(payload.transferCandidates[0].id);
      } else {
        setTransferCandidateId("");
      }
      await loadTeamStatusRules(teamId);
    } catch (error: any) {
      console.error("Erro ao carregar membros:", error);
      toast.error(error?.message || "Erro ao carregar dados do time.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleOpenManageTeam = (teamId: string, teamName: string) => {
    setManageTeamId(teamId);
    setManageTeamName(teamName);
    setIsManageOpen(true);
    setSelectedProfileId("");
    setAddMemberQuery("");
    setIsAddMemberDropdownOpen(false);
    setHighlightedEligibleProfileIndex(-1);
    loadManageData(teamId);
  };

  const handleRenameTeam = async () => {
    if (!manageTeamId) return;
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      toast.error("Informe um nome valido para o time.");
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": manageTeamId,
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível atualizar o time.");
      }
      toast.success("Nome do time atualizado.");
      setManageTeamName(trimmedName);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao atualizar time:", error);
      toast.error(error?.message || "Erro ao atualizar time.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleToggleTransferTarget = async (targetTeamId: string, checked: boolean) => {
    if (!manageTeamId || !canManageTransferRoutes) return;

    const nextTargets = checked
      ? Array.from(new Set([...transferTargets.map((item) => item.teamId), targetTeamId]))
      : transferTargets.filter((item) => item.teamId !== targetTeamId).map((item) => item.teamId);

    setSavingTransferTargets(true);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": manageTeamId,
        },
        body: JSON.stringify({
          name: renameValue.trim() || manageTeamName,
          transferTargetTeamIds: nextTargets,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível atualizar os destinos de transferência.");
      }

      const nextTransferTargets = teams
        .filter((team) => nextTargets.includes(team.id))
        .map((team) => ({ teamId: team.id, teamName: team.name }));
      setTransferTargets(nextTransferTargets);
      toast.success("Destinos de transferência atualizados.");
    } catch (error: any) {
      Sentry.captureException(error);
      console.error("Erro ao atualizar destinos de transferência:", error);
      toast.error(error?.message || "Erro ao atualizar destinos de transferência.");
    } finally {
      setSavingTransferTargets(false);
    }
  };

  const handleAddMember = async () => {
    if (!manageTeamId || !selectedProfileId) {
      toast.error("Selecione um usuário para adicionar.");
      return;
    }

    setIsAddingMember(true);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": manageTeamId,
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível adicionar membro.");
      }
      toast.success("Membro adicionado.");
      setSelectedProfileId("");
      setAddMemberQuery("");
      setIsAddMemberDropdownOpen(false);
      setHighlightedEligibleProfileIndex(-1);
      await loadManageData(manageTeamId);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao adicionar membro:", error);
      toast.error(error?.message || "Erro ao adicionar membro.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (profileId: string) => {
    if (!manageTeamId) return;
    setRemovingMemberId(profileId);
    try {
      const response = await fetch(`/api/v1/teams/${manageTeamId}/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": manageTeamId,
        },
        body: JSON.stringify({ profileId }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Não foi possível remover membro.");
      }
      toast.success("Membro removido.");
      await loadManageData(manageTeamId);
      await refreshTeams();
    } catch (error: any) {
      console.error("Erro ao remover membro:", error);
      toast.error(error?.message || "Erro ao remover membro.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !manageTeamId) return;
    if (!confirmPassword) {
      toast.error("Informe sua senha para confirmar.");
      return;
    }

    setConfirming(true);
    try {
      if (confirmAction === "delete") {
        const response = await fetch(`/api/v1/teams/${manageTeamId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": manageTeamId,
          },
          body: JSON.stringify({ password: confirmPassword }),
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Não foi possível deletar o time.");
        }
        toast.success("Time deletado com sucesso.");
        setIsManageOpen(false);
        await refreshTeams();
      }

      if (confirmAction === "transfer") {
        if (!transferCandidateId) {
          toast.error("Selecione um novo master para transferir.");
          return;
        }
        const response = await fetch(`/api/v1/teams/${manageTeamId}/transfer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
          },
          body: JSON.stringify({
            newMasterId: transferCandidateId,
            password: confirmPassword,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Não foi possível transferir o time.");
        }
        toast.success("Time transferido com sucesso.");
        setIsManageOpen(false);
        await refreshTeams();
      }
    } catch (error: any) {
      console.error("Erro ao confirmar ação:", error);
      toast.error(error?.message || "Erro ao confirmar ação.");
    } finally {
      setConfirming(false);
      setConfirmAction(null);
      setConfirmPassword("");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <ManagerTeamsContainer
        teams={teams}
        activeTeamId={activeTeamId}
        switchingTeamId={switchingTeamId}
        cancelingPendingTeamId={cancelingPendingTeamId}
        settingDefaultTeamId={settingDefaultTeamId}
        onSetActiveTeam={(teamId) => {
          void handleSetActiveTeam(teamId);
        }}
        onSetDefaultTeam={(teamId) => {
          void handleSetDefaultTeam(teamId);
        }}
        onManageTeam={handleOpenManageTeam}
        onViewPendingCheckout={handleViewPendingCheckout}
        onEditPendingPayment={handleOpenEditPendingPayment}
        onCancelPendingTeam={handleCancelPendingTeam}
        onRefreshTeams={refreshTeams}
        onOpenCreateTeam={() => setIsCreateTeamOpen(true)}
        canManageTeams={canManageTeams}
        loading={teamsLoading}
        error={teamsError}
      />

      <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Criar novo time</DialogTitle>
            <DialogDescription>
              Informe um nome para o time e escolha a forma de pagamento para gerar o checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor="teamName">Nome do time</Label>
            <Input
              id="teamName"
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="Ex: Time Comercial"
              disabled={isCreatingTeam}
            />
          </div>
          {!hasAvailableTeamSlot && (
            <div className="flex flex-col gap-2">
              <Label>Forma de pagamento</Label>
              <RadioGroup
                value={createTeamBillingType}
                onValueChange={(value) =>
                  setCreateTeamBillingType(value === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX")
                }
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                disabled={isCreatingTeam}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PIX" id="create-team-pix" />
                  <Label htmlFor="create-team-pix">PIX</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CREDIT_CARD" id="create-team-card" />
                  <Label htmlFor="create-team-card">Cartão de crédito</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateTeamOpen(false)}
              disabled={isCreatingTeam}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateTeam} disabled={isCreatingTeam}>
              {isCreatingTeam ? "Criando..." : "Criar time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PendingPaymentEditDialog
        open={isEditPendingPaymentOpen}
        loading={pendingPaymentLoading}
        submitting={pendingPaymentSubmitting}
        billingType={pendingPaymentBillingType}
        addonLabel={pendingPaymentSummary.addonLabel}
        addonDetail={pendingPaymentSummary.addonDetail}
        totalCharge={pendingPaymentSummary.totalCharge}
        remainingMonths={pendingPaymentSummary.remainingMonths}
        onBillingTypeChange={setPendingPaymentBillingType}
        onSubmit={handleSubmitEditPendingPayment}
        onOpenChange={(open) => {
          setIsEditPendingPaymentOpen(open);
          if (!open) {
            setPendingPaymentTarget(null);
          }
        }}
      />

      <Dialog
        open={isManageOpen}
        onOpenChange={(open) => {
          setIsManageOpen(open)
          if (!open) {
            setManageTeamId(null)
            setMembers([])
            setEligibleProfiles([])
            setTransferCandidates([])
            setConfirmAction(null)
            setConfirmPassword("")
            setTransferTargets([])
            setCanManageTransferRoutes(false)
            setDisabledStatuses([])
            setLeadTimeRules({})
            setCombinedRules([])
          }
        }}
      >
          <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar time</DialogTitle>
            <DialogDescription>
              {manageTeamName
                ? `Time selecionado: ${manageTeamName}.`
                : "Atualize as configurações do time."}
            </DialogDescription>
          </DialogHeader>

          <div className="pr-4">
            {manageLoading ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full" />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Skeleton className="h-4 w-44" />
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <Tabs defaultValue="basic-info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic-info">Informações básicas</TabsTrigger>
                  <TabsTrigger value="rules">Regras</TabsTrigger>
                  <TabsTrigger value="custom-fields">Campos personalizados</TabsTrigger>
                </TabsList>
                <TabsContent value="basic-info" className="mt-4">
                  <div className="space-y-6">
              <div className="space-y-3">
                <Label>Nome do time</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    placeholder="Nome do time"
                    disabled={!canManageTeams || isRenaming}
                  />
                  <Button
                    type="button"
                    onClick={handleRenameTeam}
                    disabled={!canManageTeams || isRenaming || !renameValue.trim()}
                  >
                    {isRenaming ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Time padrão</p>
                  <p className="text-xs text-muted-foreground">
                    Este time será selecionado automaticamente ao entrar na conta.
                  </p>
                </div>
                <Switch
                  checked={isManagedTeamDefault}
                  disabled={defaultTeamToggleDisabled}
                  onCheckedChange={(checked) => {
                    if (checked && manageTeamId && !isManagedTeamDefault) {
                      void handleSetDefaultTeam(manageTeamId);
                    }
                  }}
                  aria-label={`Definir ${manageTeamName || "time"} como padrão`}
                />
              </div>

              {canManageTransferRoutes ? (
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <div>
                    <h3 className="text-sm font-medium">Times que recebem transferência</h3>
                    <p className="text-xs text-muted-foreground">
                      Só master e manager delegado visualizam esta configuração.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {teams
                      .filter((team) => team.id !== manageTeamId && !team.isPending)
                      .map((team) => {
                        const checked = transferTargets.some((item) => item.teamId === team.id);
                        return (
                          <label
                            key={team.id}
                            className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                          >
                            <span>{team.name}</span>
                            <Checkbox
                              checked={checked}
                              disabled={savingTransferTargets}
                              onCheckedChange={(value) =>
                                void handleToggleTransferTarget(team.id, value === true)
                              }
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Gerenciar membros</h3>
                    <p className="text-xs text-muted-foreground">
                      Adicione ou remova membros deste time.
                    </p>
                  </div>
                  {!canManageMembers ? (
                    <Badge variant="outline" className="text-xs">
                      Apenas master
                    </Badge>
                  ) : null}
                </div>

                {canManageMembers ? (
                  <div className="space-y-3 rounded-lg border border-border/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UserPlus className="h-4 w-4" />
                      Adicionar membro
                    </div>
                    <div className="space-y-2">
                      <Label>Usuário</Label>
                      <div ref={addMemberFieldRef} className="relative">
                        <Input
                          role="combobox"
                          aria-expanded={isAddMemberDropdownOpen}
                          aria-autocomplete="list"
                          autoComplete="off"
                          placeholder="Selecione um usuário"
                          className="placeholder:opacity-100"
                          value={addMemberQuery ?? ""}
                          onFocus={() => {
                            setIsAddMemberDropdownOpen(true);
                            if (filteredEligibleProfiles.length > 0) {
                              setHighlightedEligibleProfileIndex(0);
                            }
                          }}
                          onChange={(event) => {
                            const nextQuery = event.target.value;
                            setAddMemberQuery(nextQuery);
                            setIsAddMemberDropdownOpen(true);
                            setHighlightedEligibleProfileIndex(0);

                            if (
                              selectedEligibleProfile &&
                              nextQuery !== `${selectedEligibleProfile.name} (${selectedEligibleProfile.email})`
                            ) {
                              setSelectedProfileId("");
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setIsAddMemberDropdownOpen(false);
                              return;
                            }

                            if (!isAddMemberDropdownOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                              event.preventDefault();
                              setIsAddMemberDropdownOpen(true);
                              if (filteredEligibleProfiles.length > 0) {
                                setHighlightedEligibleProfileIndex(0);
                              }
                              return;
                            }

                            if (!isAddMemberDropdownOpen || filteredEligibleProfiles.length === 0) {
                              return;
                            }

                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setHighlightedEligibleProfileIndex((currentIndex) => {
                                const nextIndex = currentIndex + 1;
                                return nextIndex >= filteredEligibleProfiles.length ? 0 : nextIndex;
                              });
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setHighlightedEligibleProfileIndex((currentIndex) => {
                                const nextIndex = currentIndex - 1;
                                return nextIndex < 0 ? filteredEligibleProfiles.length - 1 : nextIndex;
                              });
                              return;
                            }

                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (highlightedEligibleProfileIndex < 0) return;
                              const highlightedProfile = filteredEligibleProfiles[highlightedEligibleProfileIndex];
                              if (!highlightedProfile) return;
                              setSelectedProfileId(highlightedProfile.id);
                              setAddMemberQuery(`${highlightedProfile.name} (${highlightedProfile.email})`);
                              setIsAddMemberDropdownOpen(false);
                            }
                          }}
                        />

                        {isAddMemberDropdownOpen ? (
                          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                            {filteredEligibleProfiles.length === 0 ? (
                              <div className="px-2 py-2 text-sm text-muted-foreground">
                                Nenhum usuário encontrado.
                              </div>
                            ) : (
                              filteredEligibleProfiles.map((profile, index) => (
                                <button
                                  key={profile.id}
                                  type="button"
                                  ref={(element) => {
                                    addMemberOptionRefs.current[index] = element;
                                  }}
                                  className={cn(
                                    "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                                    highlightedEligibleProfileIndex === index
                                      ? "bg-accent text-accent-foreground"
                                      : ""
                                  )}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onMouseEnter={() => {
                                    setHighlightedEligibleProfileIndex(index);
                                  }}
                                  onClick={() => {
                                    setSelectedProfileId(profile.id);
                                    setAddMemberQuery(`${profile.name} (${profile.email})`);
                                    setIsAddMemberDropdownOpen(false);
                                    setHighlightedEligibleProfileIndex(-1);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProfileId === profile.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">
                                    <span className="font-medium">{profile.name}</span>{" "}
                                    <span className="text-muted-foreground/80">({profile.email})</span>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        onClick={handleAddMember}
                        disabled={isAddingMember || !selectedProfileId}
                      >
                        {isAddingMember ? "Adicionando..." : "Adicionar membro"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {canManageMembers && manageTeamId ? (
                  <ExternalMemberInviteForm
                    teamId={manageTeamId}
                    supabaseId={supabaseId}
                    onSuccess={async () => {
                      await loadManageData(manageTeamId);
                      await refreshTeams();
                    }}
                  />
                ) : null}

                <div className="rounded-lg border border-border/60">
                  <ScrollArea className="h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead>Funções</TableHead>
                          <TableHead className="w-[80px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                              Nenhum membro encontrado para este time.
                            </TableCell>
                          </TableRow>
                        ) : (
                          members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell className="text-sm font-medium">{member.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
                              <TableCell className="text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{member.role === "manager" ? "Manager" : member.role === "backoffice" ? "Backoffice" : "Operator"}</span>
                                  {member.isMaster ? <Badge variant="secondary">Master</Badge> : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {member.functions?.length ? member.functions.join(", ") : "Sem funções"}
                              </TableCell>
                              <TableCell className="text-right">
                                {user?.isMaster && !member.isMaster ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveMember(member.profileId)}
                                        disabled={removingMemberId === member.profileId}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remover</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>

              {canManageTeams ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        Zona de Perigo
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ações irreversíveis. Proceda com cautela.
                      </p>
                    </div>

                    <div className="rounded-md border border-red-600/30 bg-muted/20">
                      {manageTeamId && manageTeamId === activeTeamId && isOnlyMasterTeam ? null : (
                        <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Deletar time</p>
                            <p className="text-xs text-muted-foreground">
                              Remove o time e todos os dados vinculados (leads, membros,
                              agendamentos).
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="h-9 font-medium border-foreground/20 hover:border-red-400 border-1 bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white cursor-pointer"
                            onClick={() => setConfirmAction("delete")}
                          >
                            Deletar time
                          </Button>
                        </div>
                      )}
                      {user?.isMaster ? (
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Transferir time</p>
                            <p className="text-xs text-muted-foreground">
                              O novo master assumira a cobranca e a gestao deste time.
                            </p>
                          </div>
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
                            <Select
                              value={transferCandidateId}
                              onValueChange={setTransferCandidateId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um novo master" />
                              </SelectTrigger>
                              <SelectContent>
                                {transferCandidates.map((candidate) => (
                                  <SelectItem key={candidate.id} value={candidate.id}>
                                    {candidate.name} ({candidate.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!transferCandidateId) {
                                  toast.error("Selecione um novo master.")
                                  return
                                }
                                setConfirmAction("transfer")
                              }}
                            >
                              Transferir time
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
                  </div>
                </TabsContent>
                <TabsContent value="rules" className="mt-4 space-y-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">Status desabilitados</h3>
                      <p className="text-sm text-muted-foreground">
                        Impede que leads sejam movidos para os status marcados.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {STATUS_OPTIONS.map((status) => (
                        <label
                          key={status.value}
                          className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={disabledStatuses.includes(status.value)}
                            onCheckedChange={(checked) =>
                              handleToggleDisabledStatus(status.value, checked === true)
                            }
                          />
                          <span>{status.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">Lead time por status</h3>
                      <p className="text-sm text-muted-foreground">
                        Tempo máximo que o card pode ficar parado em cada status.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {STATUS_OPTIONS.map((status) => {
                        const rule = leadTimeRules[status.value];
                        const enabled = !!rule;
                        return (
                          <div
                            key={status.value}
                            className="grid grid-cols-1 gap-2 rounded-md border border-border/60 px-3 py-3 md:grid-cols-[minmax(0,1fr)_120px_130px]"
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={enabled}
                                onCheckedChange={(checked) =>
                                  handleLeadTimeEnabled(status.value, checked === true)
                                }
                              />
                              <span>{status.label}</span>
                            </label>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Valor"
                              value={rule?.leadTimeValue ?? ""}
                              onChange={(event) =>
                                handleLeadTimeFieldChange(
                                  status.value,
                                  "leadTimeValue",
                                  event.target.value
                                )
                              }
                              disabled={!enabled}
                            />
                            <Select
                              value={rule?.leadTimeUnit ?? "hours"}
                              onValueChange={(value) =>
                                handleLeadTimeFieldChange(status.value, "leadTimeUnit", value)
                              }
                              disabled={!enabled}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hours">Horas</SelectItem>
                                <SelectItem value="days">Dias</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold">Regras combinadas</h3>
                        <p className="text-sm text-muted-foreground">
                          Exemplo: só mover para Boleto após DPS | Contrato.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddCombinedRule}>
                        Adicionar regra
                      </Button>
                    </div>

                    {combinedRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma regra combinada cadastrada.</p>
                    ) : (
                      <div className="space-y-3">
                        {combinedRules.map((rule) => (
                          <div key={rule.id} className="rounded-md border border-border/60 p-3 space-y-3">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Status alvo</Label>
                                <Select
                                  value={rule.targetStatus}
                                  onValueChange={(value) =>
                                    handleUpdateCombinedRule(rule.id, { targetStatus: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Status alvo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label>Status pré-requisito</Label>
                                <Select
                                  value={rule.requiredStatus}
                                  onValueChange={(value) =>
                                    handleUpdateCombinedRule(rule.id, { requiredStatus: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Status obrigatório" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map((status) => (
                                      <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={rule.isEnabled}
                                  onCheckedChange={(checked) =>
                                    handleUpdateCombinedRule(rule.id, { isEnabled: checked === true })
                                  }
                                />
                                <span>Regra ativa</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={rule.requireConfirmation}
                                  onCheckedChange={(checked) =>
                                    handleUpdateCombinedRule(rule.id, {
                                      requireConfirmation: checked === true,
                                      confirmationMessage:
                                        checked === true ? rule.confirmationMessage : "",
                                    })
                                  }
                                />
                                <span>Exigir confirmação</span>
                              </label>
                            </div>

                            {rule.requireConfirmation ? (
                              <div className="space-y-1">
                                <Label>Mensagem de confirmação</Label>
                                <Input
                                  value={rule.confirmationMessage}
                                  onChange={(event) =>
                                    handleUpdateCombinedRule(rule.id, {
                                      confirmationMessage: event.target.value,
                                    })
                                  }
                                  placeholder="Mensagem exibida ao usuário na confirmação"
                                />
                              </div>
                            ) : null}

                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveCombinedRule(rule.id)}
                              >
                                Remover regra
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveTeamStatusRules}
                      disabled={rulesLoading || rulesSaving || !hasRulesChanges}
                    >
                      {rulesSaving ? "Salvando regras..." : "Salvar regras"}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="custom-fields" className="mt-4">
                  {manageTeamId ? (
                    <TeamLeadCustomFieldsSection
                      teamId={manageTeamId}
                      supabaseId={supabaseId}
                      activeRole={activeRole}
                      isMaster={user?.isMaster}
                    />
                  ) : null}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setConfirmPassword("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "delete"
                ? "Confirmar delecao do time"
                : "Confirmar transferência do time"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? "Esta ação é irreversível e remove o time permanentemente."
                : "Ao transferir, o novo master assumira a cobranca e o gerenciamento do time."}
            </DialogDescription>
          </DialogHeader>
          {confirmAction === "delete" ? (
            <div className="rounded-md border border-red-600/30 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Você perderá:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Leads cadastrados neste time</li>
                <li>Agendamentos vinculados ao time</li>
                <li>Usuários deste time perderão acesso se não estiverem em outro time</li>
              </ul>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Digite sua senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Senha da conta"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmAction(null)
                setConfirmPassword("")
              }}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={confirming || !confirmPassword}
            >
              {confirming ? "Confirmando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
