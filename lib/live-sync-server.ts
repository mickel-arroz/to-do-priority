import type { SupabaseClient } from "@supabase/supabase-js";
import { userChannel, type LiveEvent } from "@/lib/live-sync";

/** Lo que puede tardar el aviso antes de rendirse: nunca retiene la respuesta mucho. */
const PUBLISH_TIMEOUT_MS = 1500;

/**
 * Publica un aviso en vivo en el canal del usuario (ADR 0010), con el JWT del
 * propio usuario. Lo usan las rutas que modifican datos (aviso de cambio) y la
 * generación diaria (aviso de consejo nuevo).
 *
 * Un fallo al publicar —Realtime caído o la política RLS aún sin aplicar— se
 * traga: lo que el aviso anuncia ya está guardado y los demás se pondrán al
 * día al volver a la app.
 */
export async function publishNotice(
  supabase: SupabaseClient,
  userId: string,
  event: LiveEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const channel = supabase.channel(userChannel(userId), {
    config: { private: true },
  });
  try {
    // El canal es privado: Realtime comprueba la política con el JWT del usuario
    await supabase.realtime.setAuth();
    await channel.httpSend(event, payload, { timeout: PUBLISH_TIMEOUT_MS });
  } catch (error) {
    console.warn("live-sync: no se pudo publicar el aviso", error);
  } finally {
    await supabase.removeChannel(channel).catch(() => {});
  }
}
