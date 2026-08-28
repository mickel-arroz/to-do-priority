-- Disponibilidad: el tiempo ocupado semanal del usuario. Bloques recurrentes
-- por día de la semana, no fechas concretas: describen una semana tipo, no una
-- agenda. La app no los muestra en ningún calendario ni bloquea nada con
-- ellos; su único consumidor es el prompt de la generación diaria.

create table busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 0 = domingo .. 6 = sábado, la misma convención que tasks.recurrence_weekdays
  weekday smallint not null check (weekday between 0 and 6),
  -- Minutos desde medianoche, intervalo semiabierto [start, end). 1440 es el
  -- fin del día: permite ocupar hasta medianoche sin cruzarla.
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  constraint busy_blocks_range_check check (end_minute > start_minute)
);
create index busy_blocks_user_idx on busy_blocks (user_id, weekday);

alter table busy_blocks enable row level security;

create policy "own busy_blocks select" on busy_blocks for select using (auth.uid() = user_id);
create policy "own busy_blocks insert" on busy_blocks for insert with check (auth.uid() = user_id);
create policy "own busy_blocks delete" on busy_blocks for delete using (auth.uid() = user_id);

-- La disponibilidad se guarda entera de una vez: el formulario manda la semana
-- completa y ésta reemplaza a la anterior. Va en una función para que el
-- borrado y la inserción caigan en la misma transacción y nunca quede una
-- semana a medias. Sin `security definer`: corre como el invocante, así que las
-- políticas de arriba siguen aplicando.
-- p_blocks: [{ "weekday": 0-6, "start_minute": int, "end_minute": int }, ...]
create function save_busy_blocks(p_blocks jsonb) returns void
language plpgsql as $$
begin
  delete from busy_blocks where user_id = auth.uid();

  insert into busy_blocks (user_id, weekday, start_minute, end_minute)
  select
    auth.uid(),
    (b ->> 'weekday')::smallint,
    (b ->> 'start_minute')::smallint,
    (b ->> 'end_minute')::smallint
  from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) as b;
end;
$$;
