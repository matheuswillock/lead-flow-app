import type { FilterPresetScope, FilterPresetVisibility } from "@prisma/client";

export type { FilterPresetScope, FilterPresetVisibility };

export const FILTER_PRESET_SCOPES = ["crm", "performance", "board", "carteira"] as const satisfies readonly FilterPresetScope[];

export const FILTER_PRESET_VISIBILITIES = ["private", "team"] as const satisfies readonly FilterPresetVisibility[];
