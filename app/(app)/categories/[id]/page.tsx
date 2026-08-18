import { notFound } from "next/navigation";
import { CategoryContent } from "@/components/categories/CategoryContent";
import { sortByDateAndPriority } from "@/lib/tasks";
import { attachImageUrls } from "@/lib/task-images";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import type { Category, Task } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { today } = await getUserToday();

  const [{ data: category }, { data: tasks }, { data: categories }] =
    await Promise.all([
      supabase.from("categories").select("*").eq("id", id).single(),
      supabase
        .from("tasks")
        .select("*, subtasks(*), task_images(*)")
        .eq("category_id", id)
        .eq("status", "pending"),
      supabase
        .from("categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("position")
        .order("name"),
    ]);

  if (!category) notFound();

  const tasksWithImages = await attachImageUrls(supabase, (tasks ?? []) as Task[]);

  return (
    <CategoryContent
      category={category as Category}
      tasks={sortByDateAndPriority(tasksWithImages)}
      categories={(categories ?? []) as Category[]}
      today={today}
    />
  );
}
