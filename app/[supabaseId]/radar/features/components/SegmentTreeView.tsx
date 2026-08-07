"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Mail, GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RadarSegmentCard } from "./RadarSegmentCard"
import type { RadarCustomSegmentListItem } from "../context/RadarTypes"
import type { RadarExportFormat } from "@/lib/radar/exportRadarProfiles"

type SegmentNode = RadarCustomSegmentListItem & {
  children?: SegmentNode[]
  sourceType?: "campaign" | "derived" | "manual"
}

type SegmentTreeViewProps = {
  segments: RadarCustomSegmentListItem[]
  mutationLock?: boolean
  onViewProfiles: (segment: RadarCustomSegmentListItem) => void
  onExport: (segment: RadarCustomSegmentListItem, format: RadarExportFormat) => void
  onCreateContactList: (segment: RadarCustomSegmentListItem) => void
  onEdit: (segment: RadarCustomSegmentListItem) => void
  onDelete: (segment: RadarCustomSegmentListItem) => void
  onGenerateChild: (segment: RadarCustomSegmentListItem) => void
}

function SegmentTreeNode({
  node,
  level = 0,
  mutationLock,
  onViewProfiles,
  onExport,
  onCreateContactList,
  onEdit,
  onDelete,
  onGenerateChild,
}: {
  node: SegmentNode
  level?: number
  mutationLock?: boolean
  onViewProfiles: (segment: RadarCustomSegmentListItem) => void
  onExport: (segment: RadarCustomSegmentListItem, format: RadarExportFormat) => void
  onCreateContactList: (segment: RadarCustomSegmentListItem) => void
  onEdit: (segment: RadarCustomSegmentListItem) => void
  onDelete: (segment: RadarCustomSegmentListItem) => void
  onGenerateChild: (segment: RadarCustomSegmentListItem) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className={cn("flex flex-col gap-2", level > 0 && "ml-8")}>
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="mt-4 size-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        ) : (
          <div className="mt-4 size-6" />
        )}
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            {node.sourceType === "campaign" ? (
              <div className="flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                <Mail className="size-3" />
                <span>Campanha</span>
              </div>
            ) : node.sourceType === "derived" ? (
              <div className="flex items-center gap-1 rounded-md bg-purple-500/10 px-1.5 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                <GitBranch className="size-3" />
                <span>Derivado</span>
              </div>
            ) : null}
          </div>
          <RadarSegmentCard
            name={node.name}
            description={node.description}
            count={node.count}
            variant="custom"
            isInactive={!node.isActive}
            mutationLock={mutationLock}
            onViewProfiles={node.isActive ? () => onViewProfiles(node) : undefined}
            onExport={node.isActive ? (format) => onExport(node, format) : undefined}
            onCreateContactList={node.isActive ? () => onCreateContactList(node) : undefined}
            onEdit={() => onEdit(node)}
            onDelete={() => onDelete(node)}
            onGenerateChild={node.isActive ? () => onGenerateChild(node) : undefined}
          />
        </div>
      </div>
      {hasChildren && isExpanded ? (
        <div className="flex flex-col gap-2">
          {node.children?.map((child) => (
            <SegmentTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              mutationLock={mutationLock}
              onViewProfiles={onViewProfiles}
              onExport={onExport}
              onCreateContactList={onCreateContactList}
              onEdit={onEdit}
              onDelete={onDelete}
              onGenerateChild={onGenerateChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function SegmentTreeView({
  segments,
  mutationLock,
  onViewProfiles,
  onExport,
  onCreateContactList,
  onEdit,
  onDelete,
  onGenerateChild,
}: SegmentTreeViewProps) {
  const segmentNodes: SegmentNode[] = segments.map((segment) => ({
    ...segment,
    sourceType: segment.description?.toLowerCase().includes("campanha")
      ? "campaign"
      : segment.description?.toLowerCase().includes("derivado") || segment.description?.toLowerCase().includes("filho")
        ? "derived"
        : "manual",
    children: [],
  }))

  return (
    <div className="flex flex-col gap-4">
      {segmentNodes.map((node) => (
        <SegmentTreeNode
          key={node.id}
          node={node}
          mutationLock={mutationLock}
          onViewProfiles={onViewProfiles}
          onExport={onExport}
          onCreateContactList={onCreateContactList}
          onEdit={onEdit}
          onDelete={onDelete}
          onGenerateChild={onGenerateChild}
        />
      ))}
    </div>
  )
}
