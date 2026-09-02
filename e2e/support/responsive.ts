import { expect, type Page } from "@playwright/test";

/**
 * Helper compartilhado de responsividade (mobile-first) exigido por
 * `governance:check-responsive`: toda spec E2E de página MUST importar e
 * chamar `runResponsiveChecks(page)` — ver **Responsividade mobile-first**
 * em `agents.md`. MUST NOT reimplementar estes asserts inline nas specs.
 */

export const RESPONSIVE_WIDTHS = [360, 375] as const;
export const DEFAULT_DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * Alvos de toque primários. Links `display: inline` no fluxo de texto são
 * dispensados dentro do assert (exceção de inline links da WCAG 2.5.8).
 */
const DEFAULT_TOUCH_TARGET_SELECTOR = 'a[href], button, [role="button"]';

export interface TouchTargetOptions {
  /** Seletor dos alvos de toque a medir (default: CTAs interativos). */
  selector?: string;
  /** Tamanho mínimo em px para largura e altura (default: 44). */
  minSize?: number;
}

export interface ReducedMotionOptions {
  /** Elementos animados a ignorar (ex.: spinner legítimo de loading). */
  ignoreSelector?: string;
}

export interface ResponsiveCheckOptions {
  /** Larguras mobile a validar contra overflow horizontal (default: 360 e 375). */
  widths?: readonly number[];
  touchTargets?: TouchTargetOptions;
  reducedMotion?: ReducedMotionOptions;
  /** Viewport restaurado ao final; `false` mantém o último viewport mobile. */
  restoreViewport?: { width: number; height: number } | false;
}

/** Aguarda dois frames de layout após trocar o viewport. */
async function waitForLayoutSettle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/** Luminância relativa (WCAG) a partir de "rgb(r, g, b)" ou "rgba(r, g, b, a)". */
function relativeLuminance(rgb: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(rgb);
  if (!match) return 1;
  const [r, g, b] = match[1].split(",").map((part) => Number.parseFloat(part.trim()) / 255);
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Razão de contraste WCAG entre duas cores em formato `rgb()`/`rgba()`. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Sem overflow horizontal: `scrollWidth <= innerWidth + 1` em cada largura
 * mobile (mesmo assert de agents.md — Visual Verification / Verificação medida).
 */
export async function assertNoHorizontalOverflow(
  page: Page,
  widths: readonly number[] = RESPONSIVE_WIDTHS,
): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await waitForLayoutSettle(page);
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noOverflow, `sem overflow horizontal em ${width}px`).toBe(true);
  }
}

/**
 * Alvos de toque visíveis ≥ 44×44 no viewport mobile (360px). Elementos
 * `display: inline` no fluxo de texto e elementos sem área são dispensados.
 */
export async function assertTouchTargets(
  page: Page,
  options: TouchTargetOptions = {},
): Promise<void> {
  const selector = options.selector ?? DEFAULT_TOUCH_TARGET_SELECTOR;
  const minSize = options.minSize ?? MIN_TOUCH_TARGET_PX;

  await page.setViewportSize({ width: RESPONSIVE_WIDTHS[0], height: 800 });
  await waitForLayoutSettle(page);

  const undersized = await page.evaluate(
    ({ selector: targetSelector, minSize: minTargetSize }) => {
      const describe = (element: Element) => {
        const id = element.id ? `#${element.id}` : "";
        const text = (element.textContent ?? "").trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${text ? ` "${text}"` : ""}`;
      };
      return Array.from(document.querySelectorAll(targetSelector))
        .filter((element) => {
          const style = window.getComputedStyle(element);
          if (style.display === "inline" || style.visibility === "hidden") return false;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return rect.width < minTargetSize || rect.height < minTargetSize;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${describe(element)} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
        });
    },
    { selector, minSize },
  );

  expect(
    undersized,
    `alvos de toque < ${minSize}×${minSize}px em 360px: ${undersized.join("; ")}`,
  ).toEqual([]);
}

/**
 * `prefers-reduced-motion: reduce` respeitado: após emular a preferência e
 * recarregar, nenhuma animação CSS decorativa **infinita** (duração > 50ms)
 * pode continuar rodando em elemento visível. Transições e animações
 * one-shot de entrada são toleradas. ATENÇÃO: recarrega a página.
 */
export async function assertReducedMotion(
  page: Page,
  options: ReducedMotionOptions = {},
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.waitForLoadState("load");
  await waitForLayoutSettle(page);

  const infiniteAnimations = await page.evaluate(
    ({ ignoreSelector }) => {
      const parseSeconds = (value: string) => {
        const first = value.split(",")[0]?.trim() ?? "0s";
        const numeric = Number.parseFloat(first);
        if (Number.isNaN(numeric)) return 0;
        return first.endsWith("ms") ? numeric / 1000 : numeric;
      };
      return Array.from(document.querySelectorAll("body *"))
        .filter((element) => {
          if (ignoreSelector && element.matches(ignoreSelector)) return false;
          const style = window.getComputedStyle(element);
          if (style.animationName === "none" || style.display === "none") return false;
          if (style.visibility === "hidden") return false;
          if (!style.animationIterationCount.split(",").some((count) => count.trim() === "infinite")) {
            return false;
          }
          if (style.animationPlayState.split(",").every((state) => state.trim() === "paused")) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          return parseSeconds(style.animationDuration) > 0.05;
        })
        .map((element) => {
          const style = window.getComputedStyle(element);
          return `${element.tagName.toLowerCase()}.${Array.from(element.classList).join(".")} (${style.animationName})`;
        });
    },
    { ignoreSelector: options.ignoreSelector ?? null },
  );

  expect(
    infiniteAnimations,
    `animações infinitas rodando sob prefers-reduced-motion: ${infiniteAnimations.join("; ")}`,
  ).toEqual([]);

  await page.emulateMedia({ reducedMotion: null });
}

/**
 * Pacote completo obrigatório (agents.md — Responsividade mobile-first):
 * 1. sem overflow horizontal em 360/375;
 * 2. alvos de toque ≥ 44×44 em 360px;
 * 3. `prefers-reduced-motion` respeitado (recarrega a página).
 * Chamar após a página estar carregada; asserts que dependem de estado da
 * página devem vir ANTES (o passo 3 recarrega). Restaura 1280×720 ao final.
 */
export async function runResponsiveChecks(
  page: Page,
  options: ResponsiveCheckOptions = {},
): Promise<void> {
  await assertNoHorizontalOverflow(page, options.widths ?? RESPONSIVE_WIDTHS);
  await assertTouchTargets(page, options.touchTargets ?? {});
  await assertReducedMotion(page, options.reducedMotion ?? {});

  if (options.restoreViewport !== false) {
    await page.setViewportSize(options.restoreViewport ?? DEFAULT_DESKTOP_VIEWPORT);
    await waitForLayoutSettle(page);
  }
}
