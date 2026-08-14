import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import type { SidebarCategory } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: categories }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("categories")
      .select("*, tasks(count)")
      .eq("tasks.status", "pending")
      .order("is_default", { ascending: false })
      .order("position")
      .order("name"),
  ]);

  const sidebarCategories: SidebarCategory[] = (categories ?? []).map(
    (c: Category & { tasks: { count: number }[] }) => ({
      ...c,
      taskCount: c.tasks?.[0]?.count ?? 0,
    })
  );

  return (
    <AppShell
      user={{
        name: profile?.full_name ?? user.email ?? "",
        email: user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
      }}
      categories={sidebarCategories}
    >
      {children}
    </AppShell>
  );
}
