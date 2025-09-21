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

    const usersToAssign = [
        {
            id: 'ed4ab5a4-3188-41fa-8389-481784cb1f84',
            name: 'Matheus ferreira Willock',
            avatarImageUrl: 'https://ncpzzfeiumvhvsapebxy.supabase.co/storage/v1/object/public/profile-icons/ed4ab5a4-3188-41fa-8389-481784cb1f84/1758242719666-1upqk4aq3ej.jpg'
        },
        {
            id: 'ed4ab5a4-3188-41fa-8389-481784cb1f85',
            name: 'Murillo Sazoni',
            avatarImageUrl: ''
        }
    ];

    const getAgeRange = (age: number | null): ("0-18" | "19-25" | "26-35" | "36-45" | "46-60" | "61+")[] => {
        if (!age) return [];
        
        if (age <= 18) return ["0-18"];
        if (age <= 25) return ["19-25"];
        if (age <= 35) return ["26-35"];
        if (age <= 45) return ["36-45"];
        if (age <= 60) return ["46-60"];
        return ["61+"];
    };

    useEffect(() => {
        if (selected && open) {
            form.reset({
                name: selected.name || "",
                email: selected.email || "",
                phone: selected.phone || "",
                cnpj: selected.cnpj || "",
                age: getAgeRange(selected.age),
                hasPlan: selected.hasHealthPlan ? "sim" : "nao",
                currentValue: selected.currentValue?.toString() || "",
                referenceHospital: selected.referenceHospital || "",
                ongoingTreatment: selected.currentTreatment || "",
                additionalNotes: selected.notes || "",
                meetingDate: selected.meetingDate || "",
                responsible: selected.assignedTo || ""
            });
        } else if (!selected && open) {
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
                    usersToAssign={usersToAssign}
                />
            </DialogContent>
        </Dialog>   
    );
}