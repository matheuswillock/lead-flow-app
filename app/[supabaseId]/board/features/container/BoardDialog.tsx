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
  const { open, setOpen, selected: lead, user, userLoading, refreshLeads } = useBoardContext();
  const form = useLeadForm();
  const { createLead, updateLead } = useLeads();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Função para transformar os dados do formulário para criação de lead
  const transformToCreateRequest = (data: leadFormData): CreateLeadRequest => {
    // Mapear strings do formulário para enum AgeRange
    const mapAgeStringToEnum = (ageString: string) => {
      const ageMap: Record<string, string> = {
        "0-18": "RANGE_0_18",
        "19-25": "RANGE_19_25", 
        "26-35": "RANGE_26_35",
        "36-45": "RANGE_36_45",
        "46-60": "RANGE_46_60",
        "61+": "RANGE_61_PLUS"
      };
      return ageMap[ageString];
    };

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
      age: data.age.map(mapAgeStringToEnum).filter(Boolean) as any[],
      hasHealthPlan: data.hasPlan === "sim",
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
    // Mapear strings do formulário para enum AgeRange
    const mapAgeStringToEnum = (ageString: string) => {
      const ageMap: Record<string, string> = {
        "0-18": "RANGE_0_18",
        "19-25": "RANGE_19_25", 
        "26-35": "RANGE_26_35",
        "36-45": "RANGE_36_45",
        "46-60": "RANGE_46_60",
        "61+": "RANGE_61_PLUS"
      };
      return ageMap[ageString];
    };

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
      age: data.age.map(mapAgeStringToEnum).filter(Boolean) as any[],
      hasHealthPlan: data.hasPlan === "sim",
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
        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(lead.id, updateData);
        
        if (result.success) {
          toast.success("Lead atualizado com sucesso!");
          setOpen(false);
          // Atualizar o board para refletir as mudanças
          await refreshLeads();
        } else {
          toast.error(result.message || "Erro ao atualizar lead");
        }
      } else {
        const createData = transformToCreateRequest(data);
        const result = await createLead(createData);
        
        if (result.success) {
          toast.success("Lead criado com sucesso!");
          setOpen(false);
          // Atualizar o board para refletir o novo lead
          await refreshLeads();
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

  useEffect(() => {
    if (lead && open) {
      // Mapear enum AgeRange para strings do formulário
      const mapEnumToAgeString = (ageEnum: string): string => {
        const enumMap: Record<string, string> = {
          "RANGE_0_18": "0-18",
          "RANGE_19_25": "19-25",
          "RANGE_26_35": "26-35", 
          "RANGE_36_45": "36-45",
          "RANGE_46_60": "46-60",
          "RANGE_61_PLUS": "61+"
        };
        return enumMap[ageEnum] || ageEnum;
      };

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
        age: lead.age?.map(mapEnumToAgeString).filter(Boolean) as ("0-18" | "19-25" | "26-35" | "36-45" | "46-60" | "61+")[] || [],
        hasPlan: lead.hasHealthPlan ? "sim" : "nao",
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
        age: [],
        hasPlan: undefined,
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
          />
        )}
      </DialogContent>
    </Dialog>
  );
}