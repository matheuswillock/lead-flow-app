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
  const { open, setOpen, selected: lead, user, userLoading } = useBoardContext();
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

    return {
      name: data.name,
      email: data.email,
      phone: data.phone,
      age: data.age.map(mapAgeStringToEnum).filter(Boolean) as any[],
      hasHealthPlan: data.hasPlan === "sim",
      currentValue: parseFloat(data.currentValue),
      referenceHospital: data.referenceHospital,
      currentTreatment: data.ongoingTreatment,
      notes: data.additionalNotes,
      meetingDate: data.meetingDate,
      cnpj: data.cnpj || undefined,
      assignedTo: data.responsible,
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

    return {
      name: data.name,
      email: data.email,
      phone: data.phone,
      age: data.age.map(mapAgeStringToEnum).filter(Boolean) as any[],
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
        const updateData = transformToUpdateRequest(data);
        const result = await updateLead(lead.id, updateData);
        
        if (result.success) {
          toast.success("Lead atualizado com sucesso!");
          setOpen(false);
        } else {
          toast.error(result.message || "Erro ao atualizar lead");
        }
      } else {
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

      form.reset({
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        cnpj: lead.cnpj || "",
        age: lead.age?.map(mapEnumToAgeString).filter(Boolean) as ("0-18" | "19-25" | "26-35" | "36-45" | "46-60" | "61+")[] || [],
        hasPlan: lead.hasHealthPlan ? "sim" : "nao",
        currentValue: lead.currentValue?.toString() || "",
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