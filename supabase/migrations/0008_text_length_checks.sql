-- Doble validación de longitud: cada tope de `lib/limits.ts` se repite aquí
-- como constraint, para que la base no dependa de que la API sea el único
-- camino de escritura. `tests/unit/db-limits.test.ts` compara este archivo
-- con LIMITS y falla si los dos se separan.
--
-- SEGURIDAD: este archivo solo añade constraints. No borra, no actualiza y no
-- cambia el tipo de ninguna columna. Todas se crean `not valid`, que en
-- Postgres significa "aplica a lo que se escriba a partir de ahora, no
-- revises las filas que ya existen": no hay escaneo de tabla, no hay bloqueo
-- largo y ninguna fila vieja puede hacer fallar la migración.
--
-- Antes de ejecutarlo conviene saber si hay filas que ya se pasan del tope
-- (la migración no las toca, pero `0009` sí las exigirá):
--
--   select 'tasks.title'        as campo, count(*) from tasks       where length(trim(title))  > 100
--   union all select 'tasks.description',       count(*) from tasks       where length(description) > 4000
--   union all select 'subtasks.title',          count(*) from subtasks    where length(trim(title)) > 200
--   union all select 'habits.name',             count(*) from habits      where length(trim(name))  > 120
--   union all select 'habits.description',      count(*) from habits      where length(description) > 2000
--   union all select 'categories.name',         count(*) from categories  where length(trim(name))  > 60
--   union all select 'task_completions.title_snapshot', count(*) from task_completions where length(trim(title_snapshot)) > 100;
--
-- Los campos con `trim` son los que la API trimea antes de guardar
-- (`z.string().trim()`); las descripciones no se trimean, así que se miden
-- enteras. `length` cuenta caracteres, y JS cuenta unidades UTF-16, de modo
-- que para emojis la base es más permisiva que el código: nunca al revés.
--
-- Cada bloque se traga el error de "ya existe" para que reejecutar el archivo
-- sea inofensivo.

-- LIMITS.categoryName = 60
do $$ begin
  alter table categories add constraint categories_name_length_check
    check (length(trim(name)) <= 60) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.taskTitle = 100
do $$ begin
  alter table tasks add constraint tasks_title_length_check
    check (length(trim(title)) <= 100) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.taskDescription = 4000
do $$ begin
  alter table tasks add constraint tasks_description_length_check
    check (length(description) <= 4000) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.subtaskTitle = 200
do $$ begin
  alter table subtasks add constraint subtasks_title_length_check
    check (length(trim(title)) <= 200) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.habitName = 120
do $$ begin
  alter table habits add constraint habits_name_length_check
    check (length(trim(name)) <= 120) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.habitDescription = 2000
do $$ begin
  alter table habits add constraint habits_description_length_check
    check (length(description) <= 2000) not valid;
exception when duplicate_object then null; end $$;

-- LIMITS.taskTitle = 100: title_snapshot es una copia del título de la tarea,
-- así que hereda su tope. Si taskTitle cambia, este check cambia con él.
do $$ begin
  alter table task_completions add constraint task_completions_title_snapshot_length_check
    check (length(trim(title_snapshot)) <= 100) not valid;
exception when duplicate_object then null; end $$;
