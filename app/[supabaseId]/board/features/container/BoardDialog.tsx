import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import useBoardContext from "../context/BoardHook";
import { LeadForm } from "@/components/forms/leadForm";
import { useLeadForm } from "@/hooks/useForms";
import { leadFormData } from "@/lib/validations/validationForms";
import { useState, useEffect } from "react";

export default function BoardDialog() {
    const { open, setOpen, selected } = useBoardContext();
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const form = useLeadForm();

    // Populate form when editing an existing lead
    useEffect(() => {
        if (selected && open) {
            form.reset({
                name: selected.name || "",
                email: selected.email || "",
                phone: selected.phone || "",
                cnpj: selected.cnpj || "",
                age: ["26-35"], // Default age range when editing
                hasPlan: selected.hasHealthPlan ? "sim" : "nao",
                currentValue: selected.currentValue?.toString() || "",
                referenceHospital: selected.referenceHospital || "",
                ongoingTreatment: selected.currentTreatment || "",
                additionalNotes: selected.notes || "",
                meetingDate: selected.meetingDate || "",
                responsible: selected.assignedTo || ""
            });
        } else if (!selected && open) {
            // Clear form for new lead
            form.reset();
        }
    }, [selected, open, form]);

    async function onSubmit(data: leadFormData) {
        setIsLoading(true);
        try {
            if (selected) {
                setIsUpdating(true);
                // Edit existing lead
                // await updateLead(selected.id, data);
                console.info("Updating lead:", selected.id, data);
                setIsUpdating(false);
            } else {
                // Create new lead
                // await createLead(data);
                console.info("Creating lead:", data);
            }
            setOpen(false);
        } catch (error) {
            console.error("Error saving lead:", error);
        } finally {
            setIsLoading(false);
        }
    }

    function onCancel() {
        form.reset();        
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selected ? `Editar lead: ${selected.name}` : "Novo lead"}</DialogTitle>
                    <DialogDescription>
                    Preencha os dados do lead para qualificação e acompanhamento.
                    </DialogDescription>
                </DialogHeader>

                <LeadForm
                    form={form}
                    onSubmit={onSubmit}
                    isLoading={isLoading}
                    isUpdating={isUpdating}
                    onCancel={onCancel}
                />
            </DialogContent>
        </Dialog>   
    );
}