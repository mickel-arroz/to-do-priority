/**
 * Un proveedor de consejos recibe un prompt y devuelve texto. El esquema JSON
 * es una **pista**: el adaptador que soporte salida estructurada lo usará de
 * forma nativa y el que no, lo ignorará y se apoyará en lo que pida el prompt.
 * La validación con Zod ocurre siempre por encima, escrita una sola vez para
 * todos los proveedores (ver docs/adr/0001).
 */
export type AdviceProvider = {
  generate(input: {
    prompt: string;
    schema?: unknown;
  }): Promise<AdviceGeneration>;
};

/**
 * Texto crudo más el modelo concreto que lo produjo. El modelo viaja aquí y no
 * en el tipo del texto porque el proveedor puede resolverlo en una cascada, y
 * queda registrado junto al consejo.
 */
export type AdviceGeneration = {
  text: string;
  model: string;
};

const DEFAULT_AI_PROVIDER = "gemini";

/**
 * Resuelve el proveedor activo desde el entorno. Añadir uno nuevo es escribir
 * su adaptador y registrarlo aquí; nada más del feature se entera.
 */
export async function createAdviceProvider(): Promise<AdviceProvider> {
  const id = process.env.AI_PROVIDER?.trim() || DEFAULT_AI_PROVIDER;

  switch (id) {
    case "gemini": {
      const { createGeminiProvider } = await import("@/lib/ai/gemini");
      return createGeminiProvider();
    }
    default:
      throw new Error(`unknown_ai_provider:${id}`);
  }
}
