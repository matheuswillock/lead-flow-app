import { expect, test } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("app/page", () => {
  test("carrega a landing sem erro e mostra o heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /ALTA PERFORMANCE/i }),
    ).toBeVisible();
  });

  test("permite fechar o aviso de cookies quando o armazenamento esta bloqueado", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      });
    });
    await page.goto("/");

    const consentNotice = page.getByText("Usamos cookies para melhorar sua experiência e analisar o uso da plataforma.");
    await expect(consentNotice).toBeVisible();
    await page.getByRole("button", { name: "Aceitar" }).click();
    await expect(consentNotice).toHaveCount(0);

    await page.locator("#top").getByRole("button", { name: "Solicitar demonstração" }).click();
    await expect(page.locator("#demo-first-name")).toHaveCSS("font-size", "16px");
  });

  test("prioriza a contratação na hero e mantém demonstração como segunda CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.locator("header").getByRole("link", { name: "Contratar online" })).toHaveCount(0);

    const heroCheckout = page.locator("#top").getByRole("link", { name: "Contratar online" });
    const heroDemo = page.locator("#top").getByRole("button", { name: "Solicitar demonstração" });
    await expect(heroCheckout).toHaveAttribute("href", "/checkout");
    await expect(heroDemo).toBeVisible();
    expect(await page.locator('#top a[href="/checkout"], #top button').allTextContents()).toEqual([
      "Contratar online",
      "Solicitar demonstração",
    ]);
    const heroBox = await heroCheckout.boundingBox();
    expect(heroBox?.width).toBeGreaterThanOrEqual(44);
    expect(heroBox?.height).toBeGreaterThanOrEqual(44);

    const finalCheckout = page.locator(".landing-final-cta").getByRole("link", { name: "Contratar online" });
    await expect(finalCheckout).toHaveAttribute("href", "/checkout");
    const finalBox = await finalCheckout.boundingBox();
    expect(finalBox?.width).toBeGreaterThanOrEqual(44);
    expect(finalBox?.height).toBeGreaterThanOrEqual(44);

    for (const width of [920, 1024]) {
      await page.setViewportSize({ width, height: 768 });
      await expect(page.getByRole("button", { name: "Abrir menu de navegação" })).toBeVisible();
      await expect(page.locator("header nav")).toBeHidden();
      const tabletCheckoutBox = await heroCheckout.boundingBox();
      expect(tabletCheckoutBox?.y + tabletCheckoutBox?.height).toBeLessThanOrEqual(768);
    }

    await page.setViewportSize({ width: 1200, height: 768 });
    await expect(page.locator("header nav")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Contratar online" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await runResponsiveChecks(page);
  });
});
