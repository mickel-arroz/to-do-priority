import { notFound } from "next/navigation";
import { CategoryContent } from "@/components/categories/CategoryContent";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import { isCategoryId, loadTaskBoard } from "@/lib/task-board";
import type { Category } from "@/lib/types";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Un id que no es un uuid ni siquiera llega a consultarse: no existe.
  if (!isCategoryId(id)) notFound();

  const supabase = await createClient();
  const { today, todayRange } = await getUserToday();

  const [{ data: category }, board, { data: categories }] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).single(),
    loadTaskBoard(supabase, { kind: "category", categoryId: id }, todayRange),
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
      tasks={board.tasks}
      categories={(categories ?? []) as Category[]}
      today={today}
    />
  );
}
