import type { AuthContext } from "@/app/api/_lib/auth";
import {
  CHANGE_EVENT,
  CLIENT_ID_HEADER,
  userChannel,
  type ChangeNotice,
} from "@/lib/live-sync";

/** Lo que puede tardar el aviso antes de rendirse: nunca retiene la respuesta mucho. */
const PUBLISH_TIMEOUT_MS = 1500;

/**
 * Avisa a los demás dispositivos y pestañas del usuario de que algo cambió
 * (ADR 0010). Toda ruta que modifica datos lo llama después de confirmar la
 * escritura. El aviso no lleva datos: sólo el `clientId` de la pestaña que
 * hizo el cambio, leído del header, para que ella misma lo ignore.
 *
 * Un fallo al publicar —Realtime caído o la política RLS aún sin aplicar— se
 * traga: la escritura ya está hecha y los demás se pondrán al día al volver a
 * la app.
 */
export async function notifyChange(
  ctx: AuthContext,
  request: Request
): Promise<void> {
  const notice: ChangeNotice = {
    origin: request.headers.get(CLIENT_ID_HEADER),
  };
  const channel = ctx.supabase.channel(userChannel(ctx.user.id), {
    config: { private: true },
  });
  try {
    // El canal es privado: Realtime comprueba la política con el JWT del usuario
    await ctx.supabase.realtime.setAuth();
    await channel.httpSend(CHANGE_EVENT, notice, { timeout: PUBLISH_TIMEOUT_MS });
  } catch (error) {
    console.warn("live-sync: no se pudo publicar el aviso", error);
  } finally {
    await ctx.supabase.removeChannel(channel).catch(() => {});
  }
}
