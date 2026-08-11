"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCronExecutions } from "../context/useCronExecutionsHook"
import {
  formatCronExecutionDateTime,
  formatCronExecutionDuration,
  type CronExecutionItem,
} from "../context/CronExecutionsContextTypes"
import { BackofficeCronStatusBadge } from "./BackofficeCronStatusBadge"

function DetailField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  )
}

export function BackofficeCronExecutionDetailsBody({
  execution,
}: {
  execution: CronExecutionItem
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <DetailField label="Cron">
          <span className="font-mono text-xs">{execution.cronKey}</span>
        </DetailField>
        <DetailField label="Status">
          <BackofficeCronStatusBadge status={execution.status} />
        </DetailField>
        <DetailField label="Início">
          {formatCronExecutionDateTime(execution.startedAt)}
        </DetailField>
        <DetailField label="Fim">
          {formatCronExecutionDateTime(execution.finishedAt)}
        </DetailField>
        <DetailField label="Duração">
          {formatCronExecutionDuration(execution.durationMs)}
        </DetailField>
        <DetailField label="Rota" className="col-span-2">
          <span className="font-mono text-xs break-all">{execution.cronPath}</span>
        </DetailField>
      </div>

      {execution.errorSummary ? (
        <DetailField label="Resumo do erro">
          <p className="rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
            {execution.errorSummary}
          </p>
        </DetailField>
      ) : null}

      {execution.errorDetail ? (
        <DetailField label="Stack trace completo">
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
            {execution.errorDetail}
          </pre>
        </DetailField>
      ) : null}

      {execution.metadata ? (
        <DetailField label="Metadata">
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {JSON.stringify(execution.metadata, null, 2)}
          </pre>
        </DetailField>
      ) : null}
    </div>
  )
}

export function BackofficeCronExecutionDetailsSheet() {
  const { selectedExecution, selectExecution } = useCronExecutions()

  return (
    <Sheet
      open={Boolean(selectedExecution)}
      onOpenChange={(open) => {
        if (!open) selectExecution(null)
      }}
    >
      <SheetContent
        side="right"
        className="flex max-h-[100dvh] w-full flex-col gap-0 sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>Detalhes da execução</SheetTitle>
          <SheetDescription>
            {selectedExecution
              ? `${selectedExecution.cronKey} · ${formatCronExecutionDateTime(selectedExecution.startedAt)}`
              : "Selecione uma execução para ver os detalhes."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {selectedExecution ? (
            <BackofficeCronExecutionDetailsBody execution={selectedExecution} />
          ) : null}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => selectExecution(null)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
