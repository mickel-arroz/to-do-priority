import { GoogleGenAI } from "@google/genai";
import type { AdviceGeneration, AdviceProvider } from "@/lib/ai/provider";

/**
 * Cascada de modelos. Si Google retira uno, la generación cae al siguiente en
 * vez de romperse.
 */
const MODELS = ["gemini-3.5-flash", "gemini-2.5-pro", "gemini-2.5-flash"];

/** Un reintento inmediato por modelo: corremos dentro de una función serverless. */
const ATTEMPTS_PER_MODEL = 2;

function errorMessage(err: unknown): string {
  return String((err as Error)?.message ?? err);
}

/** El modelo no existe o la clave no lo alcanza: reintentar es inútil. */
function isModelUnavailable(err: unknown): boolean {
  return /\b404\b|NOT_FOUND|not found|PERMISSION_DENIED|\b403\b/i.test(
    errorMessage(err)
  );
}

/** Cuota agotada: el modelo existe pero no va a responder hoy. */
function isQuotaError(err: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(errorMessage(err));
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
      const errors: string[] = [];

      for (const model of MODELS) {
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                temperature: 0.7,
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
