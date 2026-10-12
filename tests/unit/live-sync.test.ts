import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveSync, type ChangeNotice } from "@/lib/live-sync";

/** Un canal falso: el test emite los avisos a mano. */
function fakeChannel() {
  let listener: ((notice: ChangeNotice) => void) | null = null;
  const disconnect = vi.fn(() => {
    listener = null;
  });
  const connect = vi.fn((onNotice: (notice: ChangeNotice) => void) => {
    listener = onNotice;
    return disconnect;
  });
  return {
    connect,
    disconnect,
    emit: (notice: ChangeNotice) => listener?.(notice),
  };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility("visible");
});

describe("createLiveSync", () => {
  it("avisa de un cambio ajeno tras agrupar unos 300 ms", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(299);
    expect(onRemoteChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("ignora los avisos de su propia pestaña", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit({ origin: "yo" });
    vi.advanceTimersByTime(1000);
    expect(onRemoteChange).not.toHaveBeenCalled();
  });

  it("un aviso sin origen cuenta como ajeno", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit({ origin: null });
    vi.advanceTimersByTime(300);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("una ráfaga de avisos produce un solo aviso", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(200);
    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(200);
    channel.emit({ origin: "tercero" });
    vi.advanceTimersByTime(300);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("avisa al recuperar visibilidad, no al perderla", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    setVisibility("hidden");
    vi.advanceTimersByTime(1000);
    expect(onRemoteChange).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(300);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("al cancelar la suscripción cierra el canal y deja de avisar", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    const unsubscribe = sync.subscribe(onRemoteChange);

    channel.emit({ origin: "otro" });
    unsubscribe();
    setVisibility("visible");
    vi.advanceTimersByTime(5_000);

    expect(channel.disconnect).toHaveBeenCalledTimes(1);
    expect(onRemoteChange).not.toHaveBeenCalled();
  });

  it("varios suscriptores comparten un solo canal, que se cierra al irse el último", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const first = vi.fn();
    const second = vi.fn();
    const leaveFirst = sync.subscribe(first);
    const leaveSecond = sync.subscribe(second);
    expect(channel.connect).toHaveBeenCalledTimes(1);

    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(300);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    leaveFirst();
    expect(channel.disconnect).not.toHaveBeenCalled();
    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(300);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    leaveSecond();
    vi.advanceTimersByTime(5_000);
    expect(channel.disconnect).toHaveBeenCalledTimes(1);
  });

  it("al cambiar de página conserva el canal: el nuevo suscriptor llega antes de cerrarlo", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const leaveHome = sync.subscribe(vi.fn());

    // Navegar desmonta el listado viejo y monta el nuevo en el mismo tick
    leaveHome();
    const onCategory = vi.fn();
    sync.subscribe(onCategory);
    vi.advanceTimersByTime(5_000);

    expect(channel.connect).toHaveBeenCalledTimes(1);
    expect(channel.disconnect).not.toHaveBeenCalled();
    channel.emit({ origin: "otro" });
    vi.advanceTimersByTime(300);
    expect(onCategory).toHaveBeenCalledTimes(1);
  });

  it("expone el clientId que se envía con cada cambio", () => {
    const sync = createLiveSync({ clientId: "yo", connect: fakeChannel().connect });
    expect(sync.clientId).toBe("yo");
  });
});
