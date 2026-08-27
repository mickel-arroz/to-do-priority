import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adviceWindowStart,
  buildAdvicePayload,
  linkedTaskIds,
  parseAdviceResponse,
  shouldGenerateAdvice,
  wasAdviceAttemptedToday,
} from "@/lib/advice";
import { adviceSchema, buildAdvicePrompt } from "@/lib/ai/advice-prompt";
import { createAdviceProvider } from "@/lib/ai/provider";
import type { Habit, HabitLog, Task } from "@/lib/types";

/**
 * Generación diaria: una única petición a la IA por usuario y por día, de la
 * que salen a la vez el consejo de inicio y los consejos de todos sus hábitos
 * activos (ver docs/adr/0002).
 *
 * La dispara `after()` desde el layout autenticado, así que corre después de
 * enviar la respuesta y nunca entra en el camino del render. Por eso jamás
 * lanza: el usuario no puede hacer nada con un fallo de la IA, y mientras tanto
 * sigue viendo el consejo de ayer o una frase motivacional.
 */
export async function runDailyAdviceGeneration(
  supabase: SupabaseClient,
  today: string
): Promise<void> {
  try {
    // Esto corre en cada navegación autenticada, así que lo primero es la
    // pregunta más barata: una lectura por clave primaria. Casi siempre corta
    // aquí y no se toca ninguna otra tabla.
    const { data: state, error: stateError } = await supabase
      .from("user_advice")
      .select("last_attempt_date")
      .maybeSingle();

    // Sin poder leer el estado no hay idempotencia posible, así que no se
    // sigue. El caso típico es que falte la migración 0005.
    if (stateError) {
      console.error("[advice] no se pudo leer user_advice", stateError.message);
      return;
    }

    const lastAttemptDate = state?.last_attempt_date ?? null;

    if (wasAdviceAttemptedToday(lastAttemptDate, today)) return;

    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from("habits").select("*, habit_tasks(task_id)"),
      supabase.from("habit_logs").select("*"),
    ]);

    // Sólo las tareas que la carga mira: las pendientes, las resueltas dentro
    // de la ventana y las vinculadas a un hábito, sin importar cuándo se
    // resolvieron. Traer el historial entero no aportaría nada al prompt.
    const linked = linkedTaskIds((habits ?? []) as Habit[]);
    const filters = [
      "status.eq.pending",
      `completed_at.gte.${adviceWindowStart(today)}`,
    ];
    if (linked.length > 0) filters.push(`id.in.(${linked.join(",")})`);

    // Con sus subtareas: son los pasos con los que se aconseja sobre un hábito.
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*, subtasks(*)")
      .or(filters.join(","));

    const payload = buildAdvicePayload({
      tasks: (tasks ?? []) as Task[],
      habits: (habits ?? []) as Habit[],
      logs: (logs ?? []) as HabitLog[],
      today,
    });

    if (!shouldGenerateAdvice({ payload, lastAttemptDate, today })) return;

    // Reclamar el día es lo último antes de gastar la llamada: si otra
    // ejecución ya se lo llevó, ésta se retira sin llamar.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_advice_day",
      { p_day: today }
    );
    if (claimError) {
      console.error("[advice] no se pudo reclamar el día", claimError.message);
      return;
    }
    // Otra pestaña se llevó el día: es lo normal, no es un fallo.
    if (claimed !== true) return;

    const provider = await createAdviceProvider();
    const { text, model } = await provider.generate({
      prompt: buildAdvicePrompt(payload),
      schema: adviceSchema,
    });

    const parsed = parseAdviceResponse(
      text,
      payload.habits.map((h) => h.id)
    );

    const { error: saveError } = await supabase.rpc("save_daily_advice", {
      p_day: today,
      p_model: model,
      p_home_es: parsed.home.es,
      p_home_en: parsed.home.en,
      p_habits: Object.entries(parsed.habits).map(([habitId, advice]) => ({
        habitId,
        es: advice.es,
        en: advice.en,
      })),
    });
    if (saveError) {
      console.error("[advice] no se pudo guardar el consejo", saveError.message);
      return;
    }

    // Una vez al día por usuario: no ensucia el log y confirma que funcionó.
    console.log(
      `[advice] generado con ${model}: inicio + ${Object.keys(parsed.habits).length} hábito(s)`
    );
  } catch (error) {
    // El día ya quedó reclamado, así que esto no se reintenta hoy
    console.error("[advice] generación diaria fallida", error);
  }
}
