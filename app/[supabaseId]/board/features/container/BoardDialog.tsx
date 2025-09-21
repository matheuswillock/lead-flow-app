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

export default function BoardDialog() {
  const { open, setOpen, selected: lead } = useBoardContext();
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Função para transformar os dados do formulário para criação de lead
  const transformToCreateRequest = (data: leadFormData): CreateLeadRequest => {
    return {
      name: data.name,
      email: data.email,
      phone: data.phone,
      age: data.age.length > 0 ? parseInt(data.age[0].split('-')[0]) : undefined, // Converte primeira faixa etária para número
      hasHealthPlan: data.hasPlan === "sim",
      currentValue: parseFloat(data.currentValue),
      referenceHospital: data.referenceHospital,
      currentTreatment: data.ongoingTreatment,
      notes: data.additionalNotes,
      meetingDate: data.meetingDate,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible,
      status: "new_opportunity" // Status padrão para novos leads
    };
  };

  // Função para transformar os dados do formulário para atualização de lead
  const transformToUpdateRequest = (data: leadFormData): UpdateLeadRequest => {
    return {
      name: data.name,
      email: data.email,
      phone: data.phone,
      age: data.age.length > 0 ? parseInt(data.age[0].split('-')[0]) : undefined, // Converte primeira faixa etária para número
      hasHealthPlan: data.hasPlan === "sim",
      currentValue: parseFloat(data.currentValue),
      referenceHospital: data.referenceHospital,
      currentTreatment: data.ongoingTreatment,
      notes: data.additionalNotes,
      meetingDate: data.meetingDate,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible
    };
  };

  const onSubmit = async (data: leadFormData) => {
    setIsSubmitting(true);
    
    try {
      if (lead) {
        // Atualizar lead existente
        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(lead.id, updateData);
        
        if (result.success) {
          toast.success("Lead atualizado com sucesso!");
          setOpen(false);
        } else {
          toast.error(result.message || "Erro ao atualizar lead");
        }
      } else {
        // Criar novo lead
        const createData = transformToCreateRequest(data);
        const result = await createLead(createData);
        
        if (result.success) {
          toast.success("Lead criado com sucesso!");
          setOpen(false);
        } else {
          toast.error(result.message || "Erro ao criar lead");
        }
      }
    } catch (error) {
      console.error("Erro na submissão do formulário:", error);
      toast.error("Erro inesperado ao processar o formulário");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preencher o formulário quando um lead for selecionado para edição
  useEffect(() => {
    if (lead && open) {
      // Função para mapear a idade para as faixas etárias corretas
      const getAgeRange = (age: number): ("0-18" | "19-25" | "26-35" | "36-45" | "46-60" | "61+")[] => {
        if (age <= 18) return ["0-18"];
        if (age <= 25) return ["19-25"];
        if (age <= 35) return ["26-35"];
        if (age <= 45) return ["36-45"];
        if (age <= 60) return ["46-60"];
        return ["61+"];
      };

      form.reset({
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        cnpj: lead.cnpj || "",
        age: lead.age ? getAgeRange(lead.age) : [],
        hasPlan: lead.hasHealthPlan ? "sim" : "nao",
        currentValue: lead.currentValue?.toString() || "",
        referenceHospital: lead.referenceHospital || "",
        ongoingTreatment: lead.currentTreatment || "",
        additionalNotes: lead.notes || "",
        meetingDate: lead.meetingDate || "",
        responsible: lead.assignedTo || "",
      });
    } else if (!lead && open) {
      // Reset do formulário para criação de novo lead
      form.reset();
    }
  }, [lead, open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lead ? "Editar Lead" : "Novo Lead"}
          </DialogTitle>
          <DialogDescription>
            {lead 
              ? "Faça as alterações necessárias nos dados do lead."
              : "Preencha os dados para criar um novo lead."
            }
          </DialogDescription>
        </DialogHeader>
        
        <LeadForm
          form={form}
          onSubmit={onSubmit}
          isLoading={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}