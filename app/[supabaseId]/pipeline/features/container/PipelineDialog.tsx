import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import usePipelineContext from "../context/PipelineHook";
import { LeadForm } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { leadFormData } from "@/lib/validations/validationForms";
import { useState, useEffect } from "react";
import { useLeads } from "@/hooks/useLeads";
import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "@/app/api/v1/leads/DTO/requestToUpdateLead";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { FinalizeContractDialog, FinalizeContractData } from "@/app/[supabaseId]/board/features/container/FinalizeContractDialog";

export default function PipelineDialog() {
  const { open, setOpen, selected: lead, user, userLoading, refreshLeads, finalizeContract } = usePipelineContext();
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  // Verificar se o lead pode ter o contrato finalizado
  const canFinalizeContract = lead && (
    lead.status === 'invoicePayment' || 
    lead.status === 'dps_agreement' ||
    lead.status === 'offerSubmission'
  );

  // Função para transformar os dados do formulário para criação de lead
  const transformToCreateRequest = (data: leadFormData): CreateLeadRequest => {
    const parseCurrentValue = (value: string): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanValue);
      
      if (isNaN(parsed) || parsed < 0) return undefined;
      return parsed;
    };

    const parseMeetingDate = (date: string): string | undefined => {
      if (!date || date.trim() === '') return undefined;
      try {
        if (date.includes('T') && date.includes('Z')) {
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
      meetingDate: parseMeetingDate(data.meetingDate || ''),
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      status: "new_opportunity" as any
    };
  };

  // Função para transformar os dados do formulário para atualização de lead
  const transformToUpdateRequest = (data: leadFormData): UpdateLeadRequest => {
    const parseCurrentValue = (value: string): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanValue);
      
      if (isNaN(parsed) || parsed < 0) return undefined;
      return parsed;
    };

    const parseMeetingDate = (date: string): string | undefined => {
      if (!date || date.trim() === '') return undefined;
      try {
        if (date.includes('T') && date.includes('Z')) {
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
      meetingDate: parseMeetingDate(data.meetingDate || ''),
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible || undefined,
      status: lead?.status as any
    };
  };

  // Reset form quando mudar o lead selecionado
  useEffect(() => {
    if (!open) {
      form.reset();
      return;
    }

    if (lead) {
      const formatMeetingDate = (dateString: string | null): string => {
        if (!dateString) return '';
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return '';
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
          return '';
        }
      };

      form.reset({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        cnpj: lead.cnpj || "",
        age: lead.age || "",
        currentHealthPlan: lead.currentHealthPlan || undefined,
        currentValue: lead.currentValue?.toString() || "",
        referenceHospital: lead.referenceHospital || "",
        ongoingTreatment: lead.currentTreatment || "",
        additionalNotes: lead.notes || "",
        meetingDate: formatMeetingDate(lead.meetingDate),
        responsible: lead.assignedTo || "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        cnpj: "",
        age: "",
        currentHealthPlan: undefined,
        currentValue: "",
        referenceHospital: "",
        ongoingTreatment: "",
        additionalNotes: "",
        meetingDate: "",
        responsible: "",
      });
    }
  }, [lead, open, form]);

  const handleFinalize = async (contractData: FinalizeContractData) => {
    if (!lead) return;
    
    try {
      await finalizeContract(lead.id, contractData);
      toast.success('Contrato finalizado com sucesso!');
      setShowFinalizeDialog(false);
      setOpen(false);
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao finalizar contrato');
      throw error;
    }
  };

  const onSubmit = async (data: leadFormData) => {
    if (userLoading || !user) {
      toast.error("Aguarde o carregamento dos dados do usuário");
      return;
    }

    setIsSubmitting(true);

    try {
      if (lead) {
        const updateData = transformToUpdateRequest(data);
        console.info("[PipelineDialog] Updating lead:", lead.id, updateData);

        const result = await updateLead(lead.id, updateData);

        if (result.success) {
          toast.success("Lead atualizado com sucesso!");
          await refreshLeads();
          setOpen(false);
        } else {
          const errorMsg = result.message || "Erro ao atualizar lead";
          toast.error(errorMsg);
          console.error("[PipelineDialog] Error updating lead:", result.message);
        }
      } else {
        const createData = transformToCreateRequest(data);
        console.info("[PipelineDialog] Creating new lead:", createData);

        const result = await createLead(createData);
        console.info("[PipelineDialog] Create result:", result);

        if (result.success) {
          toast.success("Lead criado com sucesso!");
          await refreshLeads();
          setOpen(false);
        } else {
          const errorMsg = result.message || "Erro ao criar lead";
          console.error("[PipelineDialog] Showing error toast:", errorMsg);
          toast.error(errorMsg);
          console.error("[PipelineDialog] Error creating lead:", result.message);
        }
      }
    } catch (error) {
      console.error("[PipelineDialog] Exception:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado ao salvar lead";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showFinalizeDialog} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            <DialogDescription>
              {lead 
                ? "Edite as informações do lead abaixo" 
                : "Preencha as informações para criar um novo lead"}
            </DialogDescription>
          </DialogHeader>

          {canFinalizeContract && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-green-900 dark:text-green-100">
                    Pronto para finalizar?
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Este lead está pronto para ter o contrato finalizado
                  </p>
                </div>
                <Button
                  onClick={() => setShowFinalizeDialog(true)}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 size-4" />
                  Finalizar Contrato
                </Button>
              </div>
            </div>
          )}

          <LeadForm 
            form={form} 
            onSubmit={onSubmit} 
            isLoading={isSubmitting}
            onCancel={() => setOpen(false)}
            usersToAssign={user?.usersAssociated || []}
            leadId={lead?.id}
          />
        </DialogContent>
      </Dialog>

      {lead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          leadName={lead.name}
          onFinalize={handleFinalize}
        />
      )}
    </>
  );
}
