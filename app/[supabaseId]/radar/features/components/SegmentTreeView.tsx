"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Mail, GitBranch } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RadarSegmentCard } from "./RadarSegmentCard"
import type { RadarCustomSegmentListItem } from "../context/RadarTypes"
import type { RadarExportFormat } from "@/lib/radar/exportRadarProfiles"

type SegmentNode = RadarCustomSegmentListItem & {
  childNodes: SegmentNode[]
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

function buildSegmentTree(segments: RadarCustomSegmentListItem[]): SegmentNode[] {
  const byId = new Map<string, SegmentNode>()
  for (const segment of segments) {
    byId.set(segment.id, { ...segment, childNodes: [] })
  }

  const roots: SegmentNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.childNodes.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: SegmentNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    for (const node of nodes) sortNodes(node.childNodes)
  }
  sortNodes(roots)
  return roots
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
  const hasChildren = node.childNodes.length > 0

  return (
    <div className={cn("flex flex-col gap-2", level > 0 && "ml-6 border-l border-border pl-4")}>
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="mt-4 size-6"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Recolher filhos" : "Expandir filhos"}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <div className="mt-4 size-6" />
        )}
        <div className="flex flex-1 flex-col gap-2">
          {node.sourceType === "campaign" ? (
            <Badge variant="secondary" className="w-fit gap-1">
              <Mail data-icon="inline-start" />
              Campanha
            </Badge>
          ) : node.sourceType === "child" ? (
            <Badge variant="secondary" className="w-fit gap-1">
              <GitBranch data-icon="inline-start" />
              Derivado
            </Badge>
          ) : null}
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
          {node.childNodes.map((child) => (
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
  const roots = useMemo(() => buildSegmentTree(segments), [segments])

  return (
    <div className="flex flex-col gap-4">
      {roots.map((node) => (
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
