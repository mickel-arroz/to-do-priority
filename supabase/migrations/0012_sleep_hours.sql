-- Horas de sueño del usuario: cuántas descuenta el prompt de la generación
-- diaria antes de repartir el día. Hasta ahora eran 7 fijas; ahora se eligen
-- en el diálogo de disponibilidad, de 0 a 24 y en horas enteras.
--
-- ORDEN: se puede aplicar antes o después de desplegar el código. Sin la
-- columna, la app sigue descontando 7 horas y el diálogo ignora el valor al
-- guardar, así que nada se rompe mientras tanto.
--
-- SEGURIDAD: añade una columna con default a `profiles`; las filas existentes
-- quedan en 7, que es justo lo que se descontaba antes. Reejecutar el archivo
-- es inofensivo: la columna y el check sólo se crean si faltan. Las políticas
-- de `profiles` (0002) ya permiten a cada usuario leer y actualizar el suyo.

alter table profiles add column if not exists sleep_hours smallint not null default 7;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_sleep_hours_check'
  ) then
    alter table profiles add constraint profiles_sleep_hours_check
      check (sleep_hours between 0 and 24);
  end if;
end;
$$;
