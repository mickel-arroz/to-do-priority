import type { AuthContext } from "@/app/api/_lib/auth";
import {
  CHANGE_EVENT,
  CLIENT_ID_HEADER,
  type ChangeNotice,
} from "@/lib/live-sync";
import { publishNotice } from "@/lib/live-sync-server";

/**
 * Avisa a los demás dispositivos y pestañas del usuario de que algo cambió
 * (ADR 0010). Toda ruta que modifica datos lo llama después de confirmar la
 * escritura. El aviso no lleva datos: sólo el `clientId` de la pestaña que
 * hizo el cambio, leído del header, para que ella misma lo ignore. Un fallo
 * al publicar no hace fallar la mutación.
 */
export async function notifyChange(
  ctx: AuthContext,
  request: Request
): Promise<void> {
  const notice: ChangeNotice = {
    origin: request.headers.get(CLIENT_ID_HEADER),
  };
  await publishNotice(ctx.supabase, ctx.user.id, CHANGE_EVENT, notice);
}
