import { Skeleton } from "@/components/ui/skeleton"

export default function BackofficeFormTemplateEditorLoading() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[70vh] w-full" />
    </div>
  )
}
