import { ListsContent } from "@/components/categories/ListsContent";
import type { SidebarCategory } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function ListsPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*, tasks(count)")
    .eq("tasks.status", "pending")
    .order("is_default", { ascending: false })
    .order("position")
    .order("name");

  const listCategories: SidebarCategory[] = (categories ?? []).map(
    (c: Category & { tasks: { count: number }[] }) => ({
      ...c,
      taskCount: c.tasks?.[0]?.count ?? 0,
    })
  );

  return <ListsContent categories={listCategories} />;
}
