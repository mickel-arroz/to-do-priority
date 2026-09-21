-- `habit_logs` sólo guarda días acreditados. Las filas 'missed' las escribía
-- el backfill de `POST /api/habits/[id]/logs`, que ya no existe, y ningún
-- lector las miraba: fallado y neutro se derivan en lectura de las tareas
-- vinculadas (ver docs/adr/0009-habit-logs-only-record-accredited-days.md).
--
-- ORDEN: ejecutar ANTES de desplegar el código que acompaña a esta migración,
-- o junto con él. El código conserva un filtro defensivo por si quedan filas
-- 'missed', pero la fuente de verdad pasa a ser este esquema.
--
-- SEGURIDAD: borra únicamente filas con status = 'missed', que no aportan
-- información (el calendario y el progreso las ignoraban). Las filas
-- 'completed' no se tocan. Postgres no permite quitar un valor de un enum, así
-- que el tipo se recrea con el único valor que queda. Reejecutar el archivo es
-- inofensivo: si el enum ya no tiene 'missed', no hace nada.

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'habit_log_status' and e.enumlabel = 'missed'
  ) then
    delete from habit_logs where status = 'missed';

    create type habit_log_status_next as enum ('completed');

    alter table habit_logs
      alter column status type habit_log_status_next
      using status::text::habit_log_status_next;

    drop type habit_log_status;

    alter type habit_log_status_next rename to habit_log_status;
  end if;
end $$;
