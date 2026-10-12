-- Canal privado de avisos en vivo por usuario (docs/adr/0010-realtime-broadcast-solo-aviso.md).
--
-- Tras cada escritura, las rutas de app/api/* publican un aviso sin datos en
-- el canal `user:<id>` de Realtime Broadcast, y cada pestaña del usuario se
-- suscribe a él para volver a pedir sus datos. Los canales son privados: el
-- acceso lo decide RLS sobre `realtime.messages`, y estas políticas sólo dejan
-- a cada usuario autenticado escuchar y publicar en su propio canal.
--
-- ORDEN: se puede aplicar antes o después de desplegar el código. Sin estas
-- políticas la suscripción y la publicación fallan en silencio y la app queda
-- como antes, más el refresco al volver a la app.
--
-- SEGURIDAD: sólo añade políticas sobre `realtime.messages`, limitadas a la
-- extensión broadcast y al topic del propio usuario; no toca ninguna tabla de
-- la app. Reejecutar el archivo es inofensivo: cada política se borra y se
-- vuelve a crear igual.

drop policy if exists "own live-sync channel receive" on realtime.messages;
create policy "own live-sync channel receive"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

drop policy if exists "own live-sync channel send" on realtime.messages;
create policy "own live-sync channel send"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );
