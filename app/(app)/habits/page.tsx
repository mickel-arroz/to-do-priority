import { HabitsContent } from "@/components/habits/HabitsContent";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import type { Habit, HabitLog, Task } from "@/lib/types";

export default async function HabitsPage() {
  const supabase = await createClient();
  const { today } = await getUserToday();

  const [{ data: habits }, { data: logs }, { data: tasks }] = await Promise.all([
    supabase
      .from("habits")
      .select("*, habit_tasks(task_id)")
      .order("created_at"),
    supabase.from("habit_logs").select("*"),
    supabase
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .order("due_date"),
  ]);

  return (
    <HabitsContent
      habits={(habits ?? []) as Habit[]}
      logs={(logs ?? []) as HabitLog[]}
      tasks={(tasks ?? []) as Task[]}
      today={today}
    />
  );
}
