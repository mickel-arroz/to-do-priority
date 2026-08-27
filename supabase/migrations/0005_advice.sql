-- Consejos diarios generados por IA. Sin histórico: todo se sobrescribe, así
-- que las tablas no crecen. Sin restricción de longitud en el texto: el tope
-- de 200 caracteres es una instrucción del modelo, no un límite del sistema.

-- Una fila por usuario: el reclamo del día más el consejo de inicio
create table user_advice (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Fecha del último intento de generación, en el día del usuario. Reclamar el
  -- día y marcar el intento son el mismo acto: un fallo no se reintenta en bucle.
  last_attempt_date date,
  -- Fecha del último consejo generado con éxito
  last_advice_date date,
  home_advice_es text,
  home_advice_en text,
  -- Modelo concreto de la cascada que produjo el consejo
  model text,
  updated_at timestamptz not null default now()
);

-- Una fila por hábito; se va con el hábito
create table habit_advice (
  habit_id uuid primary key references habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  advice_es text not null,
  advice_en text not null,
  advice_date date not null,
  updated_at timestamptz not null default now()
);
create index habit_advice_user_idx on habit_advice (user_id);

alter table user_advice enable row level security;
alter table habit_advice enable row level security;

create policy "own user_advice select" on user_advice for select using (auth.uid() = user_id);
create policy "own user_advice insert" on user_advice for insert with check (auth.uid() = user_id);
create policy "own user_advice update" on user_advice for update using (auth.uid() = user_id);

create policy "own habit_advice select" on habit_advice for select using (auth.uid() = user_id);
create policy "own habit_advice insert" on habit_advice for insert with check (auth.uid() = user_id);
create policy "own habit_advice update" on habit_advice for update using (auth.uid() = user_id);
create policy "own habit_advice delete" on habit_advice for delete using (auth.uid() = user_id);

-- Reclama el día de forma atómica: el upsert sólo actualiza si el último
-- intento no es el de hoy, así que entre varias pestañas simultáneas sólo una
-- recibe true y llama a la IA. El bloqueo de fila de Postgres las serializa.
create function claim_advice_day(p_day date) returns boolean
language plpgsql as $$
declare
  v_claimed boolean;
begin
  insert into user_advice (user_id, last_attempt_date)
  values (auth.uid(), p_day)
  on conflict (user_id) do update
    set last_attempt_date = excluded.last_attempt_date,
        updated_at = now()
    where user_advice.last_attempt_date is distinct from excluded.last_attempt_date
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

-- Escritura final en una sola transacción: consejo de inicio y consejos de
-- hábito entran juntos o no entra ninguno, para que no queden estados a medias.
-- p_habits: [{ "habitId": uuid, "es": text, "en": text }, ...]
create function save_daily_advice(
  p_day date,
  p_model text,
  p_home_es text,
  p_home_en text,
  p_habits jsonb
) returns void
language plpgsql as $$
begin
  update user_advice
  set last_advice_date = p_day,
      home_advice_es = p_home_es,
      home_advice_en = p_home_en,
      model = p_model,
      updated_at = now()
  where user_id = auth.uid();

  insert into habit_advice (habit_id, user_id, advice_es, advice_en, advice_date)
  select (h ->> 'habitId')::uuid, auth.uid(), h ->> 'es', h ->> 'en', p_day
  from jsonb_array_elements(coalesce(p_habits, '[]'::jsonb)) as h
  -- Un id que no sea del usuario no entra, pase lo que pase aguas arriba
  where exists (
    select 1 from habits
    where habits.id = (h ->> 'habitId')::uuid and habits.user_id = auth.uid()
  )
  on conflict (habit_id) do update
    set advice_es = excluded.advice_es,
        advice_en = excluded.advice_en,
        advice_date = excluded.advice_date,
        updated_at = now();
end;
$$;
