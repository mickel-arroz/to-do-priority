/**
 * Sincronización en vivo entre dispositivos (ADR 0010).
 *
 * Tras cada escritura el servidor publica un aviso sin datos en el canal
 * privado del usuario: sólo "algo cambió" y el `clientId` de la pestaña que lo
 * originó. Cada pestaña escucha ese canal, ignora sus propios avisos y, ante
 * uno ajeno, vuelve a pedir sus datos a `app/api/*`.
 *
 * Este módulo no importa Supabase: lo comparten el servidor (nombres del
 * canal, del evento y del header) y el navegador (el núcleo de la
 * suscripción, con el transporte inyectado).
 */

/** Header con el que el cliente de la API identifica la pestaña que muta. */
export const CLIENT_ID_HEADER = "x-client-id";

/** Evento de Broadcast que lleva el aviso. */
export const CHANGE_EVENT = "change";

/** Canal privado de un usuario; la política RLS sólo le deja unirse al suyo. */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/** El aviso tal como viaja: sin datos, sólo quién lo originó. */
export type ChangeNotice = { origin: string | null };

/** Se une al canal, entrega cada aviso y devuelve cómo salir de él. */
export type Connect = (onNotice: (notice: ChangeNotice) => void) => () => void;

export type LiveSync = {
  /** Identifica esta pestaña en los avisos que provoca. */
  clientId: string;
  /**
   * Llama a `onRemoteChange` cuando otra pestaña o dispositivo cambió algo, o
   * cuando la página recupera visibilidad (en móvil el socket muere en
   * segundo plano). Devuelve cómo cancelar la suscripción.
   */
  subscribe: (onRemoteChange: () => void) => () => void;
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
  const onForeignNotice = new Set<() => void>();
  let disconnect: (() => void) | null = null;
  let closing: ReturnType<typeof setTimeout> | undefined;

  return {
    clientId,
    subscribe(onRemoteChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(onRemoteChange, debounceMs);
      };

      onForeignNotice.add(schedule);
      clearTimeout(closing);
      disconnect ??= connect((notice) => {
        if (notice.origin !== clientId) onForeignNotice.forEach((s) => s());
      });
      const onVisibility = () => {
        if (document.visibilityState === "visible") schedule();
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisibility);
        onForeignNotice.delete(schedule);
        if (onForeignNotice.size > 0) return;
        clearTimeout(closing);
        closing = setTimeout(() => {
          disconnect?.();
          disconnect = null;
        }, CLOSE_GRACE_MS);
      };
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
