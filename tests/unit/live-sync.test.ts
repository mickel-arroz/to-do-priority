import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveSync, type LiveNotice } from "@/lib/live-sync";

/** Un canal falso: el test emite los avisos a mano. */
function fakeChannel() {
  let listener: ((notice: LiveNotice) => void) | null = null;
  const disconnect = vi.fn(() => {
    listener = null;
  });
  const connect = vi.fn((onNotice: (notice: LiveNotice) => void) => {
    listener = onNotice;
    return disconnect;
  });
  return {
    connect,
    disconnect,
    emit: (notice: LiveNotice) => listener?.(notice),
  };
}

const change = (origin: string | null): LiveNotice => ({ kind: "change", origin });
const newAdvice: LiveNotice = { kind: "new-advice" };

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

    channel.emit(change("otro"));
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

    channel.emit(change("yo"));
    vi.advanceTimersByTime(1000);
    expect(onRemoteChange).not.toHaveBeenCalled();
  });

  it("un aviso sin origen cuenta como ajeno", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit(change(null));
    vi.advanceTimersByTime(300);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it("una ráfaga de avisos produce un solo aviso", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    sync.subscribe(onRemoteChange);

    channel.emit(change("otro"));
    vi.advanceTimersByTime(200);
    channel.emit(change("otro"));
    vi.advanceTimersByTime(200);
    channel.emit(change("tercero"));
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

    channel.emit(change("otro"));
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

    channel.emit(change("otro"));
    vi.advanceTimersByTime(300);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    leaveFirst();
    expect(channel.disconnect).not.toHaveBeenCalled();
    channel.emit(change("otro"));
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
    channel.emit(change("otro"));
    vi.advanceTimersByTime(300);
    expect(onCategory).toHaveBeenCalledTimes(1);
  });

  it("el aviso de consejo nuevo llega al momento, también a la pestaña que lo disparó", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onNewAdvice = vi.fn();
    sync.subscribeToNewAdvice(onNewAdvice);

    channel.emit(newAdvice);
    expect(onNewAdvice).toHaveBeenCalledTimes(1);
  });

  it("los avisos de cambio y de consejo nuevo no se cruzan", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onRemoteChange = vi.fn();
    const onNewAdvice = vi.fn();
    sync.subscribe(onRemoteChange);
    sync.subscribeToNewAdvice(onNewAdvice);

    channel.emit(newAdvice);
    vi.advanceTimersByTime(1000);
    expect(onRemoteChange).not.toHaveBeenCalled();

    channel.emit(change("otro"));
    vi.advanceTimersByTime(1000);
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
    expect(onNewAdvice).toHaveBeenCalledTimes(1);
  });

  it("volver a la app no cuenta como consejo nuevo: no hay sondeo", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const onNewAdvice = vi.fn();
    sync.subscribeToNewAdvice(onNewAdvice);

    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(60_000);
    expect(onNewAdvice).not.toHaveBeenCalled();
  });

  it("ambas suscripciones comparten el canal, que se cierra al irse la última", () => {
    const channel = fakeChannel();
    const sync = createLiveSync({ clientId: "yo", connect: channel.connect });
    const leaveChanges = sync.subscribe(vi.fn());
    const onNewAdvice = vi.fn();
    const leaveAdvice = sync.subscribeToNewAdvice(onNewAdvice);
    expect(channel.connect).toHaveBeenCalledTimes(1);

    leaveChanges();
    vi.advanceTimersByTime(5_000);
    expect(channel.disconnect).not.toHaveBeenCalled();

    leaveAdvice();
    channel.emit(newAdvice);
    expect(onNewAdvice).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(channel.disconnect).toHaveBeenCalledTimes(1);
  });

  it("expone el clientId que se envía con cada cambio", () => {
    const sync = createLiveSync({ clientId: "yo", connect: fakeChannel().connect });
    expect(sync.clientId).toBe("yo");
  });
});
