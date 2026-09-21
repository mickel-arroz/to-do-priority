import { HabitsContent } from "@/components/habits/HabitsContent";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import type { LinkedTaskDay } from "@/lib/habits";
import type { Habit, HabitLog, Task } from "@/lib/types";

export default async function HabitsPage() {
  const supabase = await createClient();
  const { today } = await getUserToday();

  const [{ data: habits }, { data: logs }, { data: tasks }, { data: links }] =
    await Promise.all([
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
      // Qué días pedía algo cada hábito: el vencimiento de cada tarea
      // vinculada, en cualquier estado. Es lo que distingue un día fallado
      // de uno neutro.
      supabase.from("habit_tasks").select("habit_id, tasks!inner(due_date)"),
    ]);

  const taskDays: LinkedTaskDay[] = (links ?? []).map((l) => ({
    habit_id: l.habit_id as string,
    due_date: (l.tasks as unknown as { due_date: string }).due_date,
  }));

  return (
    <HabitsContent
      habits={(habits ?? []) as Habit[]}
      logs={(logs ?? []) as HabitLog[]}
      tasks={(tasks ?? []) as Task[]}
      taskDays={taskDays}
      today={today}
    />
  );
}
