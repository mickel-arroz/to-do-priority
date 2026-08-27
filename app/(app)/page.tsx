import { HomeContent } from "@/components/home/HomeContent";
import { toBilingual } from "@/lib/advice";
import { computeHabitProgress } from "@/lib/habits";
import { sortCompletedToday } from "@/lib/tasks";
import { attachImageUrls } from "@/lib/task-images";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import type { Category, Habit, HabitLog, Task } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { today, hour, dayOfYear } = await getUserToday();

  const [
    { data: tasks },
    { data: completedTodayTasks },
    { data: categories },
    { data: habits },
    { data: habitLogs },
    { data: advice },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, subtasks(*), task_images(*)")
      .eq("status", "pending"),
    supabase
      .from("tasks")
      .select("*")
      .in("status", ["yes", "no"])
      .gte("completed_at", `${today}T00:00:00`),
    supabase
      .from("categories")
      .select("*")
      .order("is_default", { ascending: false })
      .order("position")
      .order("name"),
    supabase.from("habits").select("*"),
    supabase.from("habit_logs").select("*"),
    supabase
      .from("user_advice")
      .select("home_advice_es, home_advice_en")
      .maybeSingle(),
    supabase.auth.getUser().then(async ({ data }) => {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user?.id ?? "")
        .single();
      return { data: p };
    }),
  ]);

  const allTasks = await attachImageUrls(supabase, (tasks ?? []) as Task[]);
  const allCategories = (categories ?? []) as Category[];

  const logsByHabit = new Map<string, HabitLog[]>();
  for (const log of (habitLogs ?? []) as HabitLog[]) {
    const list = logsByHabit.get(log.habit_id) ?? [];
    list.push(log);
    logsByHabit.set(log.habit_id, list);
  }
  const bestStreak = Math.max(
    0,
    ...((habits ?? []) as Habit[]).map(
      (h) =>
        computeHabitProgress(h, logsByHabit.get(h.id) ?? [], today).currentStreak
    )
  );

  return (
    <HomeContent
      userName={profile?.full_name ?? ""}
      hour={hour}
      today={today}
      dayOfYear={dayOfYear}
      tasks={allTasks}
      completedToday={sortCompletedToday((completedTodayTasks ?? []) as Task[])}
      categories={allCategories}
      bestStreak={bestStreak}
      advice={toBilingual(advice?.home_advice_es, advice?.home_advice_en)}
    />
  );
}
