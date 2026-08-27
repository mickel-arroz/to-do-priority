import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppShell } from "@/components/layout/AppShell";
import type { SidebarCategory } from "@/components/layout/Sidebar";
import { runDailyAdviceGeneration } from "@/lib/advice-generation";
import { getUserToday } from "@/lib/server-today";
import { createClient, createDeferredClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

/**
 * La generación diaria de consejos corre en `after()`, dentro del presupuesto
 * de esta ruta, así que la duración máxima se declara explícitamente.
 */
export const maxDuration = 60;

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

  // El día y el cliente diferido se resuelven aquí, durante el render: un
  // Server Component no puede tocar cookies ni cabeceras dentro de `after()`.
  const [{ today }, deferred] = await Promise.all([
    getUserToday(),
    createDeferredClient(),
  ]);
  // Único punto por el que pasa toda página autenticada. `after()` corre
  // después de enviar la respuesta, así que no entra en el camino del render.
  after(() => runDailyAdviceGeneration(deferred, today));

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
