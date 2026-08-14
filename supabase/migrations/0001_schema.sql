-- To-Do Priority: schema
create type task_status as enum ('pending', 'yes', 'no');
create type recurrence_type as enum ('none', 'daily', 'weekly', 'monthly', 'yearly');
create type habit_log_status as enum ('completed', 'missed');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_user_name_idx on categories (user_id, lower(name));
create unique index categories_user_default_idx on categories (user_id) where is_default;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id),
  title text not null check (length(trim(title)) > 0),
  description text,
  link text,
  due_date date not null,
  priority smallint not null check (priority between 1 and 4),
  status task_status not null default 'pending',
  completed_at timestamptz,
  pomodoro_minutes int not null default 25 check (pomodoro_minutes between 1 and 180),
  recurrence_type recurrence_type not null default 'none',
  recurrence_weekdays smallint[],
  recurrence_interval int not null default 1 check (recurrence_interval >= 1),
  recurrence_parent_id uuid references tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_status_due_idx on tasks (user_id, status, due_date);
create index tasks_category_idx on tasks (category_id);

create table subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index subtasks_task_idx on subtasks (task_id);

create table task_images (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index task_images_task_idx on task_images (task_id);

-- Permanent completion log: survives task deletion
create table task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  title_snapshot text not null,
  status task_status not null check (status in ('yes', 'no')),
  due_date date not null,
  completed_at timestamptz not null default now()
);
create index task_completions_user_date_idx on task_completions (user_id, completed_at);

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  start_date date not null default current_date,
  -- target_days null AND end_date null = indefinite habit (exempt from punishment)
  target_days int check (target_days > 0),
  end_date date,
  punishment_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table habit_tasks (
  habit_id uuid not null references habits (id) on delete cascade,
  task_id uuid not null references tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (habit_id, task_id)
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  status habit_log_status not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- updated_at
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- Max 3 images per task
create function enforce_max_task_images() returns trigger
language plpgsql as $$
begin
  if (select count(*) from task_images where task_id = new.task_id) >= 3 then
    raise exception 'max_task_images';
  end if;
  return new;
end;
$$;

create trigger task_images_max_three
  before insert on task_images
  for each row execute function enforce_max_task_images();

-- Profile + non-deletable General category on signup
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into categories (user_id, name, is_default, position)
  values (new.id, 'General', true, 0);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Protect the default category
create function protect_default_category() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_default then
      raise exception 'default_category_protected';
    end if;
    return old;
  end if;
  if old.is_default and not new.is_default then
    raise exception 'default_category_protected';
  end if;
  return new;
end;
$$;

create trigger categories_protect_default
  before delete or update on categories
  for each row execute function protect_default_category();

-- Atomic category deletion with move-or-delete strategy
create function delete_category_with_tasks(
  p_category_id uuid,
  p_move_to_general boolean
) returns void
language plpgsql as $$
declare
  v_general_id uuid;
begin
  select id into v_general_id
  from categories
  where user_id = auth.uid() and is_default;

  if p_category_id = v_general_id then
    raise exception 'default_category_protected';
  end if;

  if p_move_to_general then
    update tasks set category_id = v_general_id
    where category_id = p_category_id and user_id = auth.uid();
  else
    delete from tasks
    where category_id = p_category_id and user_id = auth.uid();
  end if;

  delete from categories
  where id = p_category_id and user_id = auth.uid();
end;
$$;
