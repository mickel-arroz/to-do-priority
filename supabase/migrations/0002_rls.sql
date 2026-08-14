-- To-Do Priority: row level security (owner-only on every table)
alter table profiles enable row level security;
alter table categories enable row level security;
alter table tasks enable row level security;
alter table subtasks enable row level security;
alter table task_images enable row level security;
alter table task_completions enable row level security;
alter table habits enable row level security;
alter table habit_tasks enable row level security;
alter table habit_logs enable row level security;

create policy "own profile select" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

create policy "own categories select" on categories for select using (auth.uid() = user_id);
create policy "own categories insert" on categories for insert with check (auth.uid() = user_id);
create policy "own categories update" on categories for update using (auth.uid() = user_id);
create policy "own categories delete" on categories for delete using (auth.uid() = user_id);

create policy "own tasks select" on tasks for select using (auth.uid() = user_id);
create policy "own tasks insert" on tasks for insert with check (auth.uid() = user_id);
create policy "own tasks update" on tasks for update using (auth.uid() = user_id);
create policy "own tasks delete" on tasks for delete using (auth.uid() = user_id);

create policy "own subtasks select" on subtasks for select using (auth.uid() = user_id);
create policy "own subtasks insert" on subtasks for insert with check (auth.uid() = user_id);
create policy "own subtasks update" on subtasks for update using (auth.uid() = user_id);
create policy "own subtasks delete" on subtasks for delete using (auth.uid() = user_id);

create policy "own task_images select" on task_images for select using (auth.uid() = user_id);
create policy "own task_images insert" on task_images for insert with check (auth.uid() = user_id);
create policy "own task_images delete" on task_images for delete using (auth.uid() = user_id);

create policy "own completions select" on task_completions for select using (auth.uid() = user_id);
create policy "own completions insert" on task_completions for insert with check (auth.uid() = user_id);

create policy "own habits select" on habits for select using (auth.uid() = user_id);
create policy "own habits insert" on habits for insert with check (auth.uid() = user_id);
create policy "own habits update" on habits for update using (auth.uid() = user_id);
create policy "own habits delete" on habits for delete using (auth.uid() = user_id);

create policy "own habit_tasks select" on habit_tasks for select using (auth.uid() = user_id);
create policy "own habit_tasks insert" on habit_tasks for insert with check (auth.uid() = user_id);
create policy "own habit_tasks delete" on habit_tasks for delete using (auth.uid() = user_id);

create policy "own habit_logs select" on habit_logs for select using (auth.uid() = user_id);
create policy "own habit_logs insert" on habit_logs for insert with check (auth.uid() = user_id);
create policy "own habit_logs update" on habit_logs for update using (auth.uid() = user_id);
create policy "own habit_logs delete" on habit_logs for delete using (auth.uid() = user_id);
