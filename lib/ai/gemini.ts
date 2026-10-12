import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { AdviceGeneration, AdviceProvider } from "@/lib/ai/provider";

/**
 * Cascada de modelos del plan gratis, del más capaz al menos. Todos son ids
 * vigentes: uno retirado no es gratis —gasta un viaje de ida y vuelta— y si la
 * cascada entera está retirada no queda nada que responda. Por eso no está
 * `gemini-3.7-flash`: está deprecado y la API lo redirige a `3.8`.
 *
 * El último no es un Gemini a propósito. La cuota no es una sola bolsa, pero sí
 * se agota por familia y de arriba abajo: los modelos grandes caen primero y
 * juntos. `gemma-4-31b-it` es de otra familia y de los más estables medidos,
 * así que sigue en pie cuando la de Gemini aprieta. Es la red de seguridad, no
 * una opción de calidad: sólo le llega el turno cuando todo lo anterior falló.
 */
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemma-4-31b-it",
];

/**
 * Como mucho un reintento inmediato por modelo, y sólo ante fallos transitorios
 * (red, 5xx, respuesta vacía): corremos dentro de una función serverless.
 */
const ATTEMPTS_PER_MODEL = 2;

/**
 * Tope por intento. La latencia de los flash es bimodal —medida con el prompt
 * real: la mayoría de respuestas caen entre 2 y 5 s, pero hay picos de más de
 * 35 s—, así que el tope no persigue la media sino que corta la cola larga sin
 * castigar a un modelo que hoy va lento.
 *
 * El suelo lo pone el más lento que aún merece la pena esperar:
 * `gemma-4-31b-it`, el último respaldo, ronda los 8 s.
 */
const ATTEMPT_TIMEOUT_MS = 12_000;

/**
 * Por debajo de esto un intento ya no cabe ni en la latencia típica (2–5 s):
 * lanzarlo sólo gastaría cuota en una petición condenada al timeout. Afecta a
 * los reintentos tardíos; el primer intento de cada modelo siempre lo supera.
 */
const MIN_ATTEMPT_MS = 4_000;

/**
 * Cada modelo tiene su franja de `ATTEMPT_TIMEOUT_MS`, y su plazo es el final
 * de esa franja contado desde el arranque de la cascada. Los reintentos de un
 * modelo sólo gastan su franja —más lo que les sobró a los anteriores—, nunca
 * la de los que vienen detrás: así el último recibe su tope entero pase lo que
 * pase antes, sean timeouts o 5xx lentos que se reintentan.
 *
 * El total es `MODELS.length * ATTEMPT_TIMEOUT_MS`. La generación corre
 * en `after()`, dentro de la misma invocación que renderiza la página
 * (`maxDuration = 60`): una llamada sin tope se lleva por delante la respuesta
 * entera con un FUNCTION_INVOCATION_TIMEOUT, y ningún consejo vale una página
 * caída. Lo que sobra hasta `maxDuration` es para el render, las lecturas que arman la carga
 * y el guardado posterior; añadir un modelo o subir el tope obliga a revisarlo.
 */
function modelDeadline(start: number, index: number): number {
  return start + (index + 1) * ATTEMPT_TIMEOUT_MS;
}

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
      const start = Date.now();
      const errors: string[] = [];

      for (const [index, model] of MODELS.entries()) {
        const deadline = modelDeadline(start, index);
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
          // Lo que queda de la franja acota el intento: un reintento nunca se
          // come el tiempo reservado a los modelos siguientes.
          const budget = Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now());
          if (budget < MIN_ATTEMPT_MS) {
            errors.push(`${model}#${attempt}: out_of_budget`);
            break;
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
