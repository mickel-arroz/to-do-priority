import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppToaster } from "@/components/layout/AppToaster";

/**
 * matchMedia controlable: `setDesktop` cambia el ancho simulado y avisa a los
 * oyentes del media query, como al redimensionar la ventana.
 */
function mockViewport(desktop: boolean) {
  let matches = desktop;
  // Sólo se avisa a las consultas de ancho, como hace el navegador con las que
  // cambian; el resto (p. ej. el tema) nunca se cumple.
  const listeners = new Set<(e: { matches: boolean }) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      const isWidth = query.includes("min-width");
      return {
        get matches() {
          return isWidth ? matches : false;
        },
        media: query,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
          if (isWidth) listeners.add(cb);
        },
        removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
          listeners.delete(cb),
      };
    })
  );
  return {
    setDesktop(next: boolean) {
      matches = next;
      act(() => listeners.forEach((cb) => cb({ matches })));
    },
  };
}

function toaster() {
  return document.querySelector<HTMLElement>("[data-sonner-toaster]")!;
}

function showToasts() {
  act(() => {
    toast.success("Guardado");
    toast.error("Falló");
  });
}

afterEach(() => {
  act(() => toast.dismiss());
  vi.unstubAllGlobals();
});

describe("AppToaster", () => {
  it("muestra los toasts abajo a la derecha en escritorio", async () => {
    mockViewport(true);
    render(<AppToaster />);
    showToasts();

    await screen.findByText("Falló");
    expect(toaster()).toHaveAttribute("data-y-position", "bottom");
    expect(toaster()).toHaveAttribute("data-x-position", "right");
  });

  it("los deja arriba al centro en móvil", async () => {
    mockViewport(false);
    render(<AppToaster />);
    showToasts();

    await screen.findByText("Falló");
    expect(toaster()).toHaveAttribute("data-y-position", "top");
    expect(toaster()).toHaveAttribute("data-x-position", "center");
  });

  it("cambia de posición al cruzar el breakpoint sin recargar", async () => {
    const viewport = mockViewport(false);
    render(<AppToaster />);
    showToasts();
    await screen.findByText("Falló");
    expect(toaster()).toHaveAttribute("data-y-position", "top");

    viewport.setDesktop(true);
    expect(toaster()).toHaveAttribute("data-y-position", "bottom");
    expect(toaster()).toHaveAttribute("data-x-position", "right");

    viewport.setDesktop(false);
    expect(toaster()).toHaveAttribute("data-y-position", "top");
  });

  it("en escritorio deja hueco abajo para el widget del pomodoro", async () => {
    mockViewport(true);
    render(<AppToaster />);
    showToasts();

    await screen.findByText("Falló");
    expect(toaster().style.getPropertyValue("--offset-bottom")).toContain(
      "var(--pomodoro-widget-clearance"
    );
  });
});
