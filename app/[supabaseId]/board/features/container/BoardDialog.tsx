import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useBoardContext from "../context/BoardHook";
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
import { FinalizeContractDialog } from "./FinalizeContractDialog";

export default function BoardDialog() {
  const { open, setOpen, selected: lead, user, userLoading, refreshLeads } = useBoardContext();
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
      
      // Retorna undefined se não é um número válido ou se é negativo
      if (isNaN(parsed) || parsed < 0) return undefined;
      
      // Retorna o valor (incluindo 0) se é válido
      return parsed;
    };

    // Helper para converter data para ISO datetime ou undefined
    const parseMeetingDate = (date: string): string | undefined => {
      if (!date || date.trim() === '') return undefined;
      try {
        // Se já é uma data ISO, retornar como está
        if (date.includes('T') && date.includes('Z')) {
          return date;
        }
        // Se é uma data no formato YYYY-MM-DD ou DD/MM/YYYY, converter para ISO
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
      status: "new_opportunity" as any // Status padrão para novos leads
    };
  };

  // Função para transformar os dados do formulário para atualização de lead
  const transformToUpdateRequest = (data: leadFormData): UpdateLeadRequest => {
    // Helper para converter valor para número ou undefined
    const parseCurrentValue = (value: string): number | undefined => {
      if (!value || value.trim() === '') return undefined;
      const cleanValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanValue);
      
      // Retorna undefined se não é um número válido ou se é negativo
      if (isNaN(parsed) || parsed < 0) return undefined;
      
      // Retorna o valor (incluindo 0) se é válido
      return parsed;
    };

    // Helper para converter data para ISO datetime ou undefined
    const parseMeetingDate = (date: string): string | undefined => {
      if (!date || date.trim() === '') return undefined;
      try {
        // Se já é uma data ISO, retornar como está
        if (date.includes('T') && date.includes('Z')) {
          return date;
        }
        // Se é uma data no formato YYYY-MM-DD ou DD/MM/YYYY, converter para ISO
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
      assignedTo: data.responsible || undefined
    };
  };

  const onSubmit = async (data: leadFormData) => {
    setIsSubmitting(true);
    
    try {
      if (lead) {
        // 🔄 EDITAR LEAD
        const loadingToast = toast.loading('Atualizando lead...');
        
        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(lead.id, updateData);
        
        if (result.success) {
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
        // ➕ CRIAR NOVO LEAD
        const loadingToast = toast.loading(`Criando lead "${data.name}"...`);
        
        // 🚀 Optimistic update - fechar dialog imediatamente
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
            // Reabrir dialog em caso de erro
            toast.error(result.message || "Erro ao criar lead", {
              id: loadingToast,
              duration: 5000,
            });
            setOpen(true);
          }
        } catch (createError) {
          // ❌ Erro específico da criação
          const errorMessage = createError instanceof Error ? createError.message : "Erro ao criar lead";
          
          // Verificar se é erro de duplicação (unique constraint)
          if (errorMessage.includes('Unique constraint') || errorMessage.includes('já existe')) {
            toast.error(`⚠️ Já existe um lead com este telefone: ${data.phone}`, {
              id: loadingToast,
              duration: 6000,
            });
          } else if (errorMessage.includes('validation') || errorMessage.includes('inválido')) {
            toast.error(`⚠️ Dados inválidos: ${errorMessage}`, {
              id: loadingToast,
              duration: 5000,
            });
          } else {
            toast.error(errorMessage, {
              id: loadingToast,
              duration: 5000,
            });
          }
          
          // Reabrir dialog para usuário corrigir
          setOpen(true);
        }
      }
    } catch (error) {
      console.error("Erro na submissão do formulário:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado ao processar o formulário";
      toast.error(errorMessage, {
        duration: 5000,
      });
      
      // Reabrir dialog em caso de erro
      if (!lead) {
        setOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeContract = () => {
    setShowFinalizeDialog(true);
  };

  const handleFinalizeSubmit = async (data: any) => {
    if (!lead) return;

    try {
      const response = await fetch(`/api/v1/leads/${lead.id}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0] || 'Erro ao finalizar contrato');
      }

      toast.success('Contrato finalizado com sucesso!');
      setShowFinalizeDialog(false);
      setOpen(false);
      await refreshLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao finalizar contrato');
      throw error;
    }
  };

  useEffect(() => {
    if (lead && open) {
      // Função para formatar valor como moeda
      const formatCurrency = (value: number): string => {
        if (value === null || value === undefined) return "";
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
      };

      // Função para formatar telefone
      const formatPhone = (phone: string): string => {
        if (!phone) return "";
        const numbers = phone.replace(/\D/g, '');
        if (numbers.length === 11) {
          return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return phone; // Retorna como está se não tiver 11 dígitos
      };

      // Função para formatar CNPJ
      const formatCNPJ = (cnpj: string): string => {
        if (!cnpj) return "";
        const numbers = cnpj.replace(/\D/g, '');
        if (numbers.length === 14) {
          return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return cnpj; // Retorna como está se não tiver 14 dígitos
      };

      form.reset({
        name: lead.name || "",
        phone: formatPhone(lead.phone || ""),
        email: lead.email || "",
        cnpj: formatCNPJ(lead.cnpj || ""),
        age: lead.age || "",
        currentHealthPlan: lead.currentHealthPlan || "",
        currentValue: lead.currentValue ? formatCurrency(lead.currentValue) : "",
        referenceHospital: lead.referenceHospital || "",
        ongoingTreatment: lead.currentTreatment || "",
        additionalNotes: lead.notes || "",
        meetingDate: lead.meetingDate || "",
        responsible: lead.assignedTo || "",
      });
    } else if (!lead && open) {
      form.reset({
        name: "",
        phone: "",
        email: "",
        cnpj: "",
        age: "",
        currentHealthPlan: "",
        currentValue: "",
        referenceHospital: "",
        ongoingTreatment: "",
        additionalNotes: "",
        meetingDate: "",
        responsible: user?.usersAssociated?.[0]?.id || "",
      });
    }
  }, [lead, open, form, user]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
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
              </div>
              {canFinalizeContract && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleFinalizeContract}
                  className="ml-4"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Fechar Contrato
                </Button>
              )}
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
            />
          )}
        </DialogContent>
      </Dialog>

      {lead && (
        <FinalizeContractDialog
          open={showFinalizeDialog}
          onOpenChange={setShowFinalizeDialog}
          leadName={lead.name}
          onFinalize={handleFinalizeSubmit}
        />
      )}
    </>
  );
}