import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useBoardContext from "../context/BoardHook";

export default function BoardDialog() {
    const { open, setOpen, selected } = useBoardContext();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selected ? `Editar lead: ${selected.name}` : "Novo lead"}</DialogTitle>
                    <DialogDescription>
                    Preencha os dados do lead para qualificação e acompanhamento.
                    </DialogDescription>
                </DialogHeader>


                {/* TODO: Add zod validations and export other component file*/}
                <form
                    className="grid gap-4 grid-cols-1 sm:grid-cols-2"
                    onSubmit={(e) => { e.preventDefault(); setOpen(false) }}
                >
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Nome Completo*</label>
                        <Input defaultValue={selected?.name ?? ""} required placeholder="Ex: Maria da Silva" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Telefone*</label>
                        <Input type="tel" placeholder="(00) 00000-0000" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Email*</label>
                        <Input type="email" placeholder="email@exemplo.com" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">CNPJ</label>
                        <Input placeholder="Digite o CNPJ" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Idades*</label>
                        <Input placeholder="Ex: 32, 29, 5" required />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Possui plano atualmente?*</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="hasPlan" value="sim" required /> Sim</label>
                            <label className="flex items-center gap-2 text-sm"><input type="radio" name="hasPlan" value="nao" /> Não</label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Valor Atual*</label>
                        <Input placeholder="R$ 0,00" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Hospital Referência (se houver)*</label>
                        <Input placeholder="Digite o hospital" required />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Existe algum tratamento em andamento?*</label>
                        <Input placeholder="Descreva brevemente" required />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Observações Adicionais*</label>
                        <Input placeholder="Observações relevantes" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Data Reunião*</label>
                        <Input type="date" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Responsável</label>
                        <Input defaultValue={selected?.assignedTo ?? ""} />
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                        <Button 
                            className="cursor-pointer" type="button" variant="ghost" onClick={() => setOpen(false)}
                        >
                        Cancelar
                        </Button>
                        <Button type="submit" className="cursor-pointer">Salvar</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>   
    );
}