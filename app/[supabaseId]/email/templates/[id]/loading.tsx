import { Skeleton } from '@/components/ui/skeleton'

export default function TemplateEditorLoading() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="flex-1">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  )
}
