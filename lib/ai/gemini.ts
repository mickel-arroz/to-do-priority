import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { AdviceGeneration, AdviceProvider } from "@/lib/ai/provider";

/**
 * Cascada de modelos, del mejor al más barato. Todos verificados contra la API
 * con la clave del proyecto: un id retirado no es gratis —gasta un viaje de ida
 * y vuelta— y si la cascada entera está retirada no queda nada que responda.
 */
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

/** Un reintento inmediato por modelo: corremos dentro de una función serverless. */
const ATTEMPTS_PER_MODEL = 2;

/**
 * Presupuesto total de la cascada.
 *
 * La generación corre en `after()`, o sea dentro de la misma invocación que
 * renderiza la página (`maxDuration = 60`). Una llamada sin tope se lleva por
 * delante la respuesta entera con un FUNCTION_INVOCATION_TIMEOUT: ningún
 * consejo vale una página caída. Pasado el presupuesto se abandona el día.
 */
const TOTAL_BUDGET_MS = 25_000;

/** Tope por intento. Medido: un flash con thinking MINIMAL responde en 2–4 s. */
const ATTEMPT_TIMEOUT_MS = 10_000;

function errorMessage(err: unknown): string {
  return String((err as Error)?.message ?? err);
}

/** El modelo no existe o la clave no lo alcanza: reintentar es inútil. */
function isModelUnavailable(err: unknown): boolean {
  return /\b404\b|NOT_FOUND|not found|no longer available|PERMISSION_DENIED|\b403\b/i.test(
    errorMessage(err)
  );
}

/** Cuota agotada: el modelo existe pero no va a responder hoy. */
function isQuotaError(err: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(errorMessage(err));
}

/** Se agotó el tope del intento: hoy este modelo va lento, no es un fallo suyo. */
function isTimeout(err: unknown): boolean {
  const name = (err as Error)?.name ?? "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /abort|timed? ?out/i.test(errorMessage(err))
  );
}

/**
 * Adaptador de Gemini. Usa el esquema como salida estructurada nativa, recorre
 * la cascada de modelos y **no espera** entre intentos: a diferencia de un job,
 * una función serverless no puede dormir 15 segundos.
 */
export function createGeminiProvider(): AdviceProvider {
  return {
    async generate({ prompt, schema }): Promise<AdviceGeneration> {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("missing_gemini_api_key");

      const ai = new GoogleGenAI({ apiKey });
      const deadline = Date.now() + TOTAL_BUDGET_MS;
      const errors: string[] = [];

      for (const model of MODELS) {
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
          // Lo que queda de presupuesto acota el intento: el último nunca puede
          // pasarse del total, aunque su tope propio sea mayor.
          const budget = Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now());
          if (budget <= 0) {
            throw new Error(
              `gemini_budget_exhausted: ${errors.join(" | ")}`
            );
          }

          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                temperature: 0.7,
                // Un consejo de 400 caracteres no necesita razonamiento largo,
                // y el thinking por defecto multiplica la latencia (medido con
                // el prompt real: 15–30 s frente a 2–4 s).
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
                // Dos cortes: el del SDK y el de la petición HTTP. Sin ellos la
                // llamada puede quedarse colgada hasta que Vercel mate la
                // función, y con ella la página.
                abortSignal: AbortSignal.timeout(budget),
                httpOptions: { timeout: budget },
                ...(schema
                  ? {
                      responseMimeType: "application/json",
                      responseSchema: schema as Record<string, unknown>,
                    }
                  : {}),
              },
            });
            const text = response.text;
            if (!text) throw new Error("empty_response");
            return { text, model };
          } catch (err) {
            errors.push(`${model}#${attempt}: ${errorMessage(err).slice(0, 200)}`);
            // Se acabó el tiempo del intento. Reintentar el mismo modelo sólo
            // gastaría el presupuesto que le queda al siguiente.
            if (isTimeout(err)) break;
            // Este modelo no existe para esta clave: no lo va a hacer en el
            // segundo intento tampoco.
            if (isModelUnavailable(err)) break;
            // La cuota de este modelo está agotada. Un job dormiría y volvería
            // a probarlo; aquí no hay esperas largas, así que el reintento
            // inmediato fallaría igual y lo que toca es el siguiente modelo.
            if (isQuotaError(err)) break;
            // Cualquier otro fallo —red, 5xx, respuesta vacía— sí puede
            // resolverse solo: ése es el reintento que queda.
          }
        }
      }

      throw new Error(`gemini_all_models_failed: ${errors.join(" | ")}`);
    },
  };
}
