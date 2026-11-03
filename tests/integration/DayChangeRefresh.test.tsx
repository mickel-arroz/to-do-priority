import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { offlineSync } from "@/lib/live-sync";
import { renderWithProviders, routerMock } from "./helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/habits",
}));

// Sin Supabase: el aviso en vivo no interviene en el cambio de día
vi.mock("@/lib/live-sync-browser", () => ({
  createBrowserLiveSync: () => offlineSync,
}));

/** Hora local del equipo, que es la que define el Día del usuario (cookie `tz`). */
const local = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

function renderApp() {
  return renderWithProviders(
    <AppShell
      userId="u1"
      user={{ name: "Mickel", email: "m@x.dev", avatarUrl: null }}
      categories={[]}
    >
      <p>página</p>
    </AppShell>
  );
}

const comeBackToTab = () =>
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cambio de Día del usuario sin recargar", () => {
  it("al cruzar la medianoche local refresca la ruta", () => {
    vi.setSystemTime(local(12, 23, 58));
    renderApp();

    act(() => vi.advanceTimersByTime(60_000));
    expect(routerMock.refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(65_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("tras el refresco queda programado para la siguiente medianoche", () => {
    vi.setSystemTime(local(12, 23, 59));
    renderApp();

    act(() => vi.advanceTimersByTime(65_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(23 * 60 * 60_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(60 * 60_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(2);
  });

  it("al volver a la pestaña con el día cambiado (equipo suspendido) refresca", () => {
    vi.setSystemTime(local(12, 22));
    renderApp();

    // Suspendido: el reloj avanza pero el temporizador no llega a dispararse
    vi.setSystemTime(local(13, 8));
    comeBackToTab();
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);

    // Ya se puso al día: el viejo temporizador no repite el refresco
    act(() => vi.advanceTimersByTime(60 * 60_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);

    // Y el nuevo apunta a la medianoche del día 13
    act(() => vi.advanceTimersByTime(16 * 60 * 60_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(2);
  });

  it("espera unos segundos tras la medianoche por si el reloj va adelantado", () => {
    vi.setSystemTime(local(12, 23, 59));
    renderApp();

    act(() => vi.advanceTimersByTime(61_000));
    expect(routerMock.refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(4_000));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("antes de refrescar pone al día la cookie de zona horaria", () => {
    vi.setSystemTime(local(12, 22));
    document.cookie = "tz=Antarctica/Troll;path=/";
    renderApp();

    vi.setSystemTime(local(13, 8));
    comeBackToTab();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(document.cookie).toContain(`tz=${tz}`);
  });

  it("al volver a la pestaña el mismo día no refresca", () => {
    vi.setSystemTime(local(12, 9));
    renderApp();

    vi.setSystemTime(local(12, 18));
    comeBackToTab();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("al desmontar deja de vigilar el día", () => {
    vi.setSystemTime(local(12, 23, 59));
    const { unmount } = renderApp();
    unmount();

    act(() => vi.advanceTimersByTime(2 * 60_000));
    vi.setSystemTime(local(14, 9));
    comeBackToTab();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });
});
