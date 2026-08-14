import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { isUnauthorized, jsonError, requireUser } from "@/app/api/_lib/auth";
import { formatDate, parseDate } from "@/lib/recurrence";

/**
 * Backfills 'missed' rows for days between start_date and yesterday that
 * have no log, so the calendar can render them. Progress math never trusts
 * these aggregates — it is always derived in lib/habits.ts.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (isUnauthorized(ctx)) return ctx;

  const { id } = await params;
  const { data: habit } = await ctx.supabase
    .from("habits")
    .select("id, start_date, end_date")
    .eq("id", id)
    .single();
  if (!habit) return jsonError("not_found", 404);

  const { data: logs } = await ctx.supabase
    .from("habit_logs")
    .select("log_date")
    .eq("habit_id", id);

  const logged = new Set((logs ?? []).map((l) => l.log_date));
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = formatDate(addDays(parseDate(today), -1));
  const lastDay =
    habit.end_date && habit.end_date < yesterday ? habit.end_date : yesterday;

  const missing: { habit_id: string; user_id: string; log_date: string; status: "missed" }[] = [];
  for (
    let day = parseDate(habit.start_date);
    formatDate(day) <= lastDay;
    day = addDays(day, 1)
  ) {
    const dateStr = formatDate(day);
    if (!logged.has(dateStr)) {
      missing.push({
        habit_id: id,
        user_id: ctx.user.id,
        log_date: dateStr,
        status: "missed",
      });
    }
  }

  if (missing.length > 0) {
    const { error } = await ctx.supabase.from("habit_logs").insert(missing);
    if (error) return jsonError(error.message, 500);
  }

  const { data: allLogs } = await ctx.supabase
    .from("habit_logs")
    .select("*")
    .eq("habit_id", id);

  return NextResponse.json({ logs: allLogs ?? [] });
}
