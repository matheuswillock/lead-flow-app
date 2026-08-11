import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { RadarProfileListItem } from "@/app/[supabaseId]/radar/features/context/RadarTypes"
import { RadarSegmentProfilesList } from "@/app/[supabaseId]/radar/features/components/RadarSegmentProfilesList"
import { removeProfileFromSegmentList } from "./radar-segment-promote-list"

function makeProfile(id: string, name: string): RadarProfileListItem {
  return {
    id,
    displayName: name,
    displayPhone: null,
    primaryEmail: `${id}@example.com`,
    lastSeenAt: "2026-08-10T12:00:00.000Z",
    engagementBand: "warm",
    primarySegmentName: "Engajados sem Lead",
    consents: [{ channel: "email", status: "allowed", reason: null }],
    sourceLinks: [{ sourceType: "email" }],
  }
}

describe("removeProfileFromSegmentList", () => {
  it("remove o perfil promovido e sinaliza removed", () => {
    const profiles = [makeProfile("p-1", "Ana"), makeProfile("p-2", "Bruno")]
    const result = removeProfileFromSegmentList(profiles, "p-1")
    expect(result.items.map((item) => item.id)).toEqual(["p-2"])
    expect(result.removed).toBe(true)
  })

  it("mantém a lista quando o perfil não está presente", () => {
    const profiles = [makeProfile("p-1", "Ana")]
    const result = removeProfileFromSegmentList(profiles, "missing")
    expect(result.items).toEqual(profiles)
    expect(result.removed).toBe(false)
  })
})

describe("RadarSegmentProfilesList", () => {
  it("renderiza promoção item a item sem ação em lote", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <RadarSegmentProfilesList
          profiles={[makeProfile("p-1", "Ana"), makeProfile("p-2", "Bruno")]}
          isLoading={false}
          page={1}
          total={2}
          pageSize={20}
          onPageChange={() => {}}
          onViewProfile={() => {}}
          showPromoteAction
          onPromoteProfile={async () => true}
        />
      </TooltipProvider>
    )

    expect((html.match(/Promover a Lead/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain("Promover selecionados")
    expect(html).not.toContain("Selecionar todos")
  })

  it("oculta promoção quando showPromoteAction é false", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <RadarSegmentProfilesList
          profiles={[makeProfile("p-1", "Ana")]}
          isLoading={false}
          page={1}
          total={1}
          pageSize={20}
          onPageChange={() => {}}
          onViewProfile={() => {}}
        />
      </TooltipProvider>
    )

    expect(html).not.toContain("Promover a Lead")
    expect(html).toContain("Detalhe")
  })
})
