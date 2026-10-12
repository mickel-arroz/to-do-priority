import { HomeContent } from "@/components/home/HomeContent";
import { toBilingual } from "@/lib/advice";
import { getUserToday } from "@/lib/server-today";
import { createClient } from "@/lib/supabase/server";
import { loadTaskBoard } from "@/lib/task-board";
import type { Category } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { today, todayRange, hour, dayOfYear } = await getUserToday();

  const [board, { data: categories }, { data: advice }, { data: profile }] =
    await Promise.all([
      loadTaskBoard(supabase, { kind: "home" }, todayRange),
      supabase
        .from("categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("position")
        .order("name"),
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

  return (
    <HomeContent
      userName={profile?.full_name ?? ""}
      hour={hour}
      today={today}
      dayOfYear={dayOfYear}
      tasks={board.tasks}
      completedToday={board.completedToday ?? []}
      categories={(categories ?? []) as Category[]}
      advice={toBilingual(advice?.home_advice_es, advice?.home_advice_en)}
    />
  );
}
