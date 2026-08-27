# El proveedor de IA devuelve texto; el esquema es sólo una pista

La interfaz de un proveedor de consejos es `generate({ prompt, schema? }): Promise<string>`:
siempre devuelve texto plano, y el esquema JSON que recibe es opcional. El adaptador de
Gemini lo pasa como `responseSchema` y obtiene JSON garantizado por el decodificador; un
proveedor que no soporte salida estructurada simplemente lo ignora y se apoya en lo que el
prompt le pide. La validación con Zod ocurre siempre por encima, escrita una sola vez para
todos los proveedores.

## Considered Options

Tipar la interfaz como `generate(prompt, schema): Promise<T>`, con cada adaptador
traduciendo el esquema al formato nativo de su API. Se descartó porque obliga a todo
proveedor futuro a soportar salida estructurada y reparte la validación entre adaptadores,
justo lo que la fábrica existe para evitar.

## Consequences

Un lector verá texto plano mientras Gemini devuelve JSON perfectamente estructurado y
pensará que falta tipado. No falta: el tipo se recupera en la capa de validación, que es
común a todos los proveedores precisamente porque la interfaz no lo impone.

## Enmienda: el modelo viaja junto al texto

Al implementarlo, la firma quedó como `generate({ prompt, schema? }): Promise<{ text, model }>`
en lugar de `Promise<string>`. La razón es que el consejo guarda **el modelo que lo produjo**
y el adaptador lo resuelve en una cascada, así que el dato no existe hasta después de la
llamada y sólo el adaptador lo conoce.

El cambio no toca nada de lo que este ADR decide: la salida sigue siendo texto sin parsear,
el esquema sigue siendo una pista opcional y la validación con Zod sigue viviendo por encima,
escrita una sola vez. Un proveedor que no tenga cascada devuelve siempre el mismo `model`.
