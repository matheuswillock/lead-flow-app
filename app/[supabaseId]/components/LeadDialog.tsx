import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadForm } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { leadFormData } from "@/lib/validations/validationForms";
import { useEffect, useState } from "react";
import { useLeads } from "@/hooks/useLeads";
import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "@/app/api/v1/leads/DTO/requestToUpdateLead";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { FinalizeContractDialog, FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes";
import type { ProfileResponseDTO } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { useParams } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeadDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  lead: Lead | null;
  user: ProfileResponseDTO | null;
  userLoading: boolean;
  refreshLeads: () => Promise<void>;
  finalizeContract: (leadId: string, data: FinalizeContractData) => Promise<void>;
}

export default function LeadDialog({
  open,
  setOpen,
  lead,
  user,
  userLoading,
  refreshLeads,
  finalizeContract,
}: LeadDialogProps) {
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [finalizeCompleted, setFinalizeCompleted] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendTarget, setResendTarget] = useState<"all" | "single">("all");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [scheduleGuests, setScheduleGuests] = useState<string[]>([]);
  const [scheduleTitle, setScheduleTitle] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const params = useParams();
  const supabaseId = params.supabaseId as string | undefined;

  const canFinalizeContract = lead && (
    lead.status === "invoicePayment" ||
    lead.status === "dps_agreement" ||
    lead.status === "offerSubmission"
  );
  const canMarkNoShow = lead?.status === "scheduled";
  const canResendInvite = Boolean(lead?.meetingDate);

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
    return options;
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
      meetingHeald: data.meetingHeald || undefined,
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
      meetingHeald: data.meetingHeald || undefined,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      closerId: data.closerId || undefined,
      ticket: data.ticket ? parseCurrentValue(data.ticket) : undefined,
      contractDueDate: parseMeetingDate(data.contractDueDate || ""),
      soldPlan: data.soldPlan || undefined,
    };
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
        meetingTitle: lead.meetingTitle || scheduleTitle || "",
        meetingNotes: lead.meetingNotes || "",
        meetingLink: lead.meetingLink || "",
        meetingHeald: lead.meetingHeald || undefined,
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
        meetingHeald: undefined,
        extraGuests: "",
        responsible: user?.usersAssociated?.[0]?.id || "",
        ticket: "",
        contractDueDate: "",
        soldPlan: undefined,
      });
    }
  }, [lead, open, form, user, scheduleGuests, scheduleTitle]);

  useEffect(() => {
    const fetchScheduleGuests = async () => {
      if (!lead || !open || !supabaseId) return;
      setScheduleLoading(true);
      try {
        const response = await fetch(`/api/v1/leads/${lead.id}/schedule`, {
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
          },
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const schedules = (data?.result || []) as Array<{
          extraGuests?: string[];
          meetingTitle?: string | null;
        }>;
        const latest = schedules[0];
        setScheduleGuests(latest?.extraGuests || []);
        setScheduleTitle(latest?.meetingTitle || null);
      } catch (error) {
        console.error("Erro ao carregar convidados extras:", error);
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchScheduleGuests();
  }, [lead, open, supabaseId]);

  const handleResendInvite = async () => {
    if (!lead || !supabaseId) return;
    if (resendTarget === "single" && !resendEmail) {
      toast.error("Selecione um participante para reenviar o convite");
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
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao reenviar convite");
      }

      toast.success("Convite reenviado com sucesso!", {
        id: loadingToast,
        duration: 3000,
      });
      setResendDialogOpen(false);
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

  return (
    <>
      <Dialog open={open && !showFinalizeDialog} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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
                {canMarkNoShow && (
                  <Button size="sm" variant="outline" onClick={handleNoShow}>
                    Marcar No-show
                  </Button>
                )}
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
            meetingInfo={{
              date: lead?.meetingDate || null,
              title: lead?.meetingTitle || scheduleTitle || null,
              link: lead?.meetingLink || null,
              notes: lead?.meetingNotes || null,
              guests: scheduleGuests,
              closerName: lead?.closer?.fullName || lead?.closer?.email || null,
            }}
            onResendInvite={() => setResendDialogOpen(true)}
          />
          )}
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
              onValueChange={(value) => setResendTarget(value as "all" | "single")}
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
    </>
  );
}
