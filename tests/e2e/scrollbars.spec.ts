import { expect, test, type Page } from "@playwright/test";

/**
 * La barra fina de desktop vive en una única regla global de
 * `app/globals.css`, y va por `::-webkit-scrollbar` por los motivos de
 * `docs/adr/0007-scrollbars-por-webkit.md`.
 *
 * Lo único que el DOM expone del scrollbar es el hueco que reserva: ni el
 * pulgar ni los botones de flecha son nodos consultables. Así que la
 * ausencia de flechas se comprueba a ojo, no aquí.
 */

/** 10px de track más el redondeo del device pixel ratio. */
const HUECO_MAXIMO = 12;

/** Hueco que reserva el scrollbar en cada eje, en un contenedor que desborda. */
async function huecoDelScrollbar(page: Page) {
  return page.evaluate(() => {
    const caja = document.createElement("div");
    caja.style.cssText =
      "position:fixed;top:0;left:0;width:200px;height:200px;overflow:scroll;visibility:hidden";
    caja.appendChild(
      Object.assign(document.createElement("div"), {
        style: "width:400px;height:400px",
      })
    );
    document.body.appendChild(caja);
    const hueco = {
      y: caja.offsetWidth - caja.clientWidth,
      x: caja.offsetHeight - caja.clientHeight,
    };
    caja.remove();
    return hueco;
  });
}

test.describe("desktop scrollbars", () => {
  test.skip(({ isMobile }) => !!isMobile, "the rule is desktop-only");

  test("both axes are narrower than the native bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeVisible();

    const hueco = await huecoDelScrollbar(page);
    // Un entorno con scrollbars overlay no reserva hueco y no hay nada que
    // medir; se salta en vez de fallar en rojo por algo que no es la regla.
    test.skip(
      hueco.x === 0 && hueco.y === 0,
      "this environment paints overlay scrollbars"
    );

    // Frente a los ~15-17px que pinta Chromium por defecto en Windows.
    expect(hueco.y).toBeLessThanOrEqual(HUECO_MAXIMO);
    expect(hueco.x).toBeLessThanOrEqual(HUECO_MAXIMO);
  });

  test("the standard properties stay undeclared in Chromium", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeVisible();

    // Guarda de la trampa del ADR: desde Chrome 121 `scrollbar-width` y
    // `scrollbar-color` anulan las reglas `::-webkit-scrollbar`, y `thin` no
    // quita las flechas. Declararlas aquí las devuelve.
    const estandar = await page.evaluate(() => {
      const estilo = getComputedStyle(document.documentElement);
      return { width: estilo.scrollbarWidth, color: estilo.scrollbarColor };
    });
    expect(estandar).toEqual({ width: "auto", color: "auto" });
  });
});

test.describe("mobile scrollbars", () => {
  test.skip(({ isMobile }) => !isMobile, "checks the coarse-pointer side");

  test("the desktop rule never reaches a coarse pointer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();

    // `@media (pointer: fine)` no casa en táctil, así que sigue el overlay
    // del sistema: no reserva hueco. Si la regla se saliera de la media
    // query, aquí aparecerían los 10px del track.
    expect(await huecoDelScrollbar(page)).toEqual({ x: 0, y: 0 });
  });
});
