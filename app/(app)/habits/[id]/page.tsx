import { notFound } from "next/navigation";
import { HabitDetailContent } from "@/components/habits/HabitDetailContent";
import { toBilingual } from "@/lib/advice";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import type { Habit, HabitLog, Task } from "@/lib/types";

export default async function HabitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { today, dayOfYear } = await getUserToday();

  const { data: habit } = await supabase
    .from("habits")
    .select("*, habit_tasks(task_id)")
    .eq("id", id)
    .single();

  if (!habit) notFound();

  const taskIds = (habit.habit_tasks ?? []).map(
    (ht: { task_id: string }) => ht.task_id
  );

  const [{ data: logs }, { data: linkedTasks }, { data: allTasks }, { data: advice }] =
    await Promise.all([
      supabase.from("habit_logs").select("*").eq("habit_id", id),
      taskIds.length > 0
        ? supabase.from("tasks").select("*").in("id", taskIds)
        : Promise.resolve({ data: [] as Task[] }),
      supabase.from("tasks").select("*").eq("status", "pending").order("due_date"),
      supabase
        .from("habit_advice")
        .select("advice_es, advice_en")
        .eq("habit_id", id)
        .maybeSingle(),
    ]);

  return (
    <HabitDetailContent
      habit={habit as Habit}
      initialLogs={(logs ?? []) as HabitLog[]}
      linkedTasks={(linkedTasks ?? []) as Task[]}
      allTasks={(allTasks ?? []) as Task[]}
      today={today}
      dayOfYear={dayOfYear}
      advice={toBilingual(advice?.advice_es, advice?.advice_en)}
    />
  );
}
