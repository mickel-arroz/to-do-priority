# Sincronización entre dispositivos por aviso de Supabase Realtime, sin datos

Para que un cambio hecho en un dispositivo aparezca en los demás sin recargar, las
rutas de `app/api/*` que mutan publican, tras cada mutación, un aviso en un canal
privado de Supabase Realtime Broadcast por usuario. El aviso no lleva datos: sólo
"algo cambió" y el `clientId` de la pestaña que lo originó. Cada pestaña se
suscribe con un cliente de Supabase en el navegador que sólo escucha, ignora sus
propios avisos y, al recibir uno ajeno, vuelve a pedir sus datos: los listados de
tareas con un GET a la API, sin recargar la página; el resto de páginas con un
refresco de sus componentes de servidor.

Es una excepción deliberada a la regla de que el navegador nunca habla con
Supabase: se permite únicamente suscribirse al canal; leer y escribir datos sigue
pasando por `app/api/*`. Se eligió porque cabe en el plan gratis de Supabase y no
añade proveedor.

## Considered Options

- Postgres Changes sobre `tasks`: manda filas completas al navegador y hace que la
  seguridad dependa sólo del RLS de cada tabla. Descartado.
- Ably o Pusher en plan gratis: otro proveedor y otras claves para lo mismo.
- SSE desde una ruta de Vercel: consume tiempo de función y la conexión se corta
  por timeout.
- Sólo `BroadcastChannel`: no cruza dispositivos.

## Consequences

Hace falta una política RLS sobre `realtime.messages` (migración idempotente) para
que cada usuario sólo pueda unirse a su propio canal. Las rutas publican con el
JWT del usuario, no con una clave de servicio, así que la política también le deja
publicar en su canal; el navegador nunca lo usa para eso.

En móvil el socket muere en segundo plano, así que además se vuelve a pedir el
listado cuando la página recupera visibilidad.
