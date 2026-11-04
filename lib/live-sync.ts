/**
 * Sincronización en vivo entre dispositivos (ADR 0010).
 *
 * Tras cada escritura el servidor publica un aviso de cambio sin datos en el
 * canal privado del usuario: sólo "algo cambió" y el `clientId` de la pestaña
 * que lo originó. Cada pestaña escucha ese canal, ignora sus propios avisos y,
 * ante uno ajeno, vuelve a pedir sus datos a `app/api/*`. Por el mismo canal
 * llega el aviso de consejo nuevo, que no viene de ninguna pestaña.
 *
 * Este módulo no importa Supabase: lo comparten el servidor (nombres del
 * canal, del evento y del header) y el navegador (el núcleo de la
 * suscripción, con el transporte inyectado).
 */

/** Header con el que el cliente de la API identifica la pestaña que muta. */
export const CLIENT_ID_HEADER = "x-client-id";

/** Evento de Broadcast que lleva el aviso de cambio. */
export const CHANGE_EVENT = "change";

/**
 * Evento de Broadcast del aviso de consejo nuevo: lo publica la generación
 * diaria al guardar consejos. No viene de ninguna pestaña, así que no lleva
 * `origin` y todas lo atienden.
 */
export const NEW_ADVICE_EVENT = "new-advice";

/** Los eventos de Broadcast que viajan por el canal del usuario. */
export type LiveEvent = typeof CHANGE_EVENT | typeof NEW_ADVICE_EVENT;

/** Canal privado de un usuario; la política RLS sólo le deja unirse al suyo. */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** El aviso de cambio tal como viaja: sin datos, sólo quién lo originó. */
export type ChangeNotice = { origin: string | null };

/** Un aviso recibido del canal, de cualquiera de sus dos clases. */
export type LiveNotice =
  | ({ kind: "change" } & ChangeNotice)
  | { kind: "new-advice" };

/** Se une al canal, entrega cada aviso y devuelve cómo salir de él. */
export type Connect = (onNotice: (notice: LiveNotice) => void) => () => void;

export type LiveSync = {
  /** Identifica esta pestaña en los avisos que provoca. */
  clientId: string;
  /**
   * Llama a `onRemoteChange` cuando otra pestaña o dispositivo cambió algo, o
   * cuando la página recupera visibilidad (en móvil el socket muere en
   * segundo plano). Devuelve cómo cancelar la suscripción.
   */
  subscribe: (onRemoteChange: () => void) => () => void;
  /**
   * Llama a `onNewAdvice` en cuanto la generación diaria guarda consejos, sin
   * agrupar ni filtrar por pestaña. Devuelve cómo cancelar la suscripción.
   */
  subscribeToNewAdvice: (onNewAdvice: () => void) => () => void;
};

/** Ventana en la que una ráfaga de avisos se agrupa en uno. */
const DEBOUNCE_MS = 300;

/** Lo que el canal sigue abierto sin suscriptores, por si llega otro al navegar. */
const CLOSE_GRACE_MS = 2_000;

export function createLiveSync({
  clientId,
  connect,
  debounceMs = DEBOUNCE_MS,
}: {
  clientId: string;
  connect: Connect;
  debounceMs?: number;
}): LiveSync {
  // Un solo canal para todos los suscriptores: lo abre el primero y se cierra
  // un rato después de irse el último. Al navegar, el listado viejo se
  // desmonta justo antes de montar el nuevo; cerrarlo ahí haría que el nuevo
  // recibiera el mismo canal a medio cerrar (Supabase reutiliza el canal por
  // topic hasta que el servidor confirma la salida) y se quedara sin avisos.
  const onForeignChange = new Set<() => void>();
  const onNewAdvice = new Set<() => void>();
  let disconnect: (() => void) | null = null;
  let closing: ReturnType<typeof setTimeout> | undefined;

  /** Añade un suscriptor, abriendo el canal si es el primero. */
  function join(listeners: Set<() => void>, listener: () => void) {
    listeners.add(listener);
    clearTimeout(closing);
    disconnect ??= connect((notice) => {
      if (notice.kind === "new-advice") onNewAdvice.forEach((l) => l());
      else if (notice.origin !== clientId) onForeignChange.forEach((l) => l());
    });
  }

  /** Quita un suscriptor y, si era el último, cierra el canal tras la gracia. */
  function leave(listeners: Set<() => void>, listener: () => void) {
    listeners.delete(listener);
    if (onForeignChange.size + onNewAdvice.size > 0) return;
    clearTimeout(closing);
    closing = setTimeout(() => {
      disconnect?.();
      disconnect = null;
    }, CLOSE_GRACE_MS);
  }

  return {
    clientId,
    subscribe(onRemoteChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(onRemoteChange, debounceMs);
      };

      join(onForeignChange, schedule);
      const onVisibility = () => {
        if (document.visibilityState === "visible") schedule();
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
        leave(onForeignChange, schedule);
      };
    },
    subscribeToNewAdvice(onAdvice) {
      // Una función propia por suscripción: el mismo callback dos veces no
      // debe colapsar en una sola entrada del Set
      const listener = () => onAdvice();
      join(onNewAdvice, listener);
      return () => leave(onNewAdvice, listener);
    },
  };
}

/** Sin canal: sólo el refresco al volver a la app. Fuera del shell, o en tests. */
export const offlineSync: LiveSync = createLiveSync({
  clientId: "offline",
  connect: () => () => {},
});

function randomId(): string {
  // randomUUID sólo existe en contextos seguros (no en http:// de la LAN)
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

let tabClientId: string | undefined;

/** El `clientId` de esta pestaña: uno por carga de la página. */
export function getTabClientId(): string {
  tabClientId ??= randomId();
  return tabClientId;
}
