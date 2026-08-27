# Una sola generación diaria por usuario, disparada al navegar

Todos los consejos de un usuario —el de inicio y el de cada hábito activo— salen de una
única petición a la IA por día. La dispara `after()` de `next/server` desde
`app/(app)/layout.tsx`, el único punto por el que pasa toda página autenticada: corre
después de enviar la respuesta, así que jamás bloquea el render. Antes de llamar, un upsert
condicional reclama el día de forma atómica, de modo que varias pestañas simultáneas
produzcan una sola llamada y un fallo no se reintente en bucle.

## Considered Options

Un cron diario que generase los consejos de todos los usuarios. Se descartó porque gastaría
llamadas en usuarios que no abren la app, y porque el disparo por navegación garantiza que
sólo se paga por quien realmente va a leer el consejo.

Una llamada por vista (una para inicio, una por cada hábito abierto). Se descartó por
multiplicar el coste sin mejorar el resultado: el modelo da mejores consejos de hábito
cuando ve el panorama completo del usuario en el mismo prompt.

## Consequences

Un consejo nuevo no aparece en la vista que lo disparó, sino en la siguiente navegación o
recarga. Es deliberado: evita cualquier estado de carga en pantalla. Un hábito creado
después de la generación del día no tiene consejo hasta mañana y muestra una frase
motivacional mientras tanto.
