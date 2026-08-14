-- Lists get a custom icon and accent color; pomodoro is opt-in (0 = off)
alter table categories add column icon text not null default 'list';
alter table categories add column color text check (color ~ '^#[0-9a-fA-F]{6}$');

alter table tasks alter column pomodoro_minutes set default 0;
alter table tasks drop constraint tasks_pomodoro_minutes_check;
alter table tasks add constraint tasks_pomodoro_minutes_check
  check (pomodoro_minutes between 0 and 180);
