import { notFound } from "next/navigation";
import { format } from "date-fns";
import { CategoryContent } from "@/components/categories/CategoryContent";
import { sortByDateAndPriority } from "@/lib/tasks";
import { createClient } from "@/lib/supabase/server";
import type { Category, Task } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");

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

  return (
    <CategoryContent
      category={category as Category}
      tasks={sortByDateAndPriority((tasks ?? []) as Task[])}
      categories={(categories ?? []) as Category[]}
      today={today}
    />
  );
}
