import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import {
  CHANGE_EVENT,
  createLiveSync,
  getTabClientId,
  userChannel,
  type LiveSync,
} from "@/lib/live-sync";

/**
 * La sincronización en vivo real: un cliente de Supabase en el navegador que
 * **sólo** se suscribe al canal privado del usuario. Es la única excepción a
 * que el navegador no hable con Supabase (ADR 0010): nunca lee ni escribe
 * datos, eso sigue pasando por `app/api/*`.
 *
 * El cliente se crea al conectarse, ya en el navegador. Si la política RLS de
 * Realtime aún no está aplicada la suscripción falla en silencio y queda el
 * refresco al volver a la app.
 */
export function createBrowserLiveSync(userId: string): LiveSync {
  let client: SupabaseClient | null = null;

  return createLiveSync({
    clientId: getTabClientId(),
    connect(onNotice) {
      client ??= createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      const supabase = client;
      const topic = userChannel(userId);
      let channel: RealtimeChannel | null = null;
      let closed = false;

      void (async () => {
        // Supabase devuelve el canal existente del mismo topic aunque esté a
        // medio cerrar, y uno así ya no se suscribe: hay que esperar a que se
        // vaya del todo antes de crear el nuevo
        const stale = supabase
          .getChannels()
          .filter((c) => c.subTopic === topic);
        await Promise.all(stale.map((c) => supabase.removeChannel(c)));
        // El canal es privado: Realtime comprueba la política con el JWT
        await supabase.realtime.setAuth();
        if (closed) return;
        channel = supabase
          .channel(topic, { config: { private: true } })
          .on("broadcast", { event: CHANGE_EVENT }, ({ payload }) => {
            const origin = (payload as { origin?: unknown } | undefined)?.origin;
            onNotice({ origin: typeof origin === "string" ? origin : null });
          })
          .subscribe();
      })().catch(() => {});

      return () => {
        closed = true;
        if (channel) void supabase.removeChannel(channel);
      };
    },
  });
}
