"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FIELD_CATALOG, LEAD_TRANSITION_FIELD_KEYS } from "@/lib/leadStatusTransitionFields";
import { GATE_TYPE_LABELS } from "@/lib/leadStatusTransitionGates";

type BackofficeTransitionRulesHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const HIGHLIGHTED_GATE_TYPES = [
  "allowed_target_statuses",
  "block_targets_when_field_equals",
  "require_meeting_heald_on_exit",
  "require_sales_info",
  "require_finalize_contract",
  "require_closer",
  "require_schedule_artifacts",
  "require_trigger_future_sale",
  "require_trigger_loss_reason",
] as const;

export function BackofficeTransitionRulesHelpDialog({
  open,
  onOpenChange,
}: BackofficeTransitionRulesHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Como configurar regras de transição</DialogTitle>
          <DialogDescription>
            Guia para montar e editar campos obrigatórios e gates aplicados nas mudanças de status
            do CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Visão geral</h3>
            <p className="text-sm text-muted-foreground">
              As regras de transição controlam o que o corretor precisa preencher ou cumprir antes
              de mover um lead de status. Existem dois mecanismos complementares:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Campos obrigatórios</span> — exigem
                dados específicos do lead conforme o status de destino escolhido.
              </li>
              <li>
                <span className="font-medium text-foreground">Gates de transição</span> — validações
                globais que bloqueiam ou condicionam mudanças de status em todo o CRM.
              </li>
            </ul>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Aba Campos obrigatórios</h3>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>Selecione o <span className="font-medium text-foreground">status destino</span>.</li>
              <li>
                Marque os campos que devem estar preenchidos antes de mover o lead para esse status:
              </li>
            </ol>
            <ul className="flex flex-col gap-1 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              {LEAD_TRANSITION_FIELD_KEYS.map((fieldKey) => (
                <li key={fieldKey}>• {FIELD_CATALOG[fieldKey].label}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Clique em <span className="font-medium text-foreground">Salvar regras</span> para
              aplicar a configuração do status selecionado. Repita o processo para cada status que
              precise de campos obrigatórios.
            </p>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Aba Gates de transição</h3>
            <p className="text-sm text-muted-foreground">
              A tabela lista todos os gates globais. Cada gate é avaliado na ordem da coluna{" "}
              <span className="font-medium text-foreground">Ordem</span> (
              <span className="font-medium text-foreground">sortOrder</span>). Use{" "}
              <span className="font-medium text-foreground">Editar</span> em uma linha para ajustar:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>Nome e mensagem de erro exibida ao corretor</li>
              <li>Ordem de execução</li>
              <li>Ativação ou desativação do gate</li>
              <li>Status de origem, destino ou listas de status (conforme o tipo do gate)</li>
            </ul>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Tipos de gate mais usados</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {HIGHLIGHTED_GATE_TYPES.map((gateType) => (
                <li key={gateType} className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">
                    {GATE_TYPE_LABELS[gateType]}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Permissões</h3>
            <p className="text-sm text-muted-foreground">
              Apenas usuários <span className="font-medium text-foreground">master</span>{" "}
              (não-operadores) podem salvar alterações nesta tela. Operadores podem visualizar as
              regras, mas não alterá-las.
            </p>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Efeito das alterações</h3>
            <p className="text-sm text-muted-foreground">
              Após salvar, as regras entram em vigor imediatamente em todas as mudanças de status do
              CRM — não é necessário reiniciar o sistema nem aguardar sincronização.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
