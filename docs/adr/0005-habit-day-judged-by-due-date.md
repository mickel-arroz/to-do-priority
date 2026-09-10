# El día de un hábito lo juzga la fecha de vencimiento, no la de cierre

Un día cuenta como cumplido cuando todas las tareas vinculadas **que vencían ese
día** quedaron cerradas con éxito. Cuándo se marcaron no interviene: completar
hoy algo que vencía ayer acredita ayer, que es el día al que pertenecía el
compromiso.

Esto obliga a que la sincronización se dispare sobre el `due_date` de la tarea
que cambia, no sobre el día del usuario. `syncHabitDaysForTask` recibe por eso
una lista de días, y al completar una tarea recurrente se recalculan dos: el
suyo y el de la instancia que nace, que puede caer en el pasado porque una tarea
vencida nunca desplaza su cadencia.

## Considered Options

Acreditar también el día en que se cierra una tarea vencida (`completed_at`), que
es como estaba escrito. Se descartó porque un día sin tareas propias se acreditaba
solo con pagar deuda vieja: bastaba arrastrar pendientes para regalarse días
objetivo, y el día en que la tarea vencía se quedaba fallado para siempre porque
nadie volvía a mirarlo.

Bloquear un día mientras el hábito arrastre cualquier tarea pendiente anterior o
igual. Se descartó porque hacía que un día ya cumplido dejara de estarlo por una
tarea ajena a él, y porque el castigo por acumular deuda ya lo cubre el modo
castigo, que es explícito y opcional.

## Consequences

El día acreditado deja de depender de la zona horaria de quien cierra la tarea
—no hace falta `getUserToday()` en las rutas de completar y de cambiar estado—,
lo que refuerza el ADR 0003 en vez de contradecirlo: el `due_date` ya se eligió
en el día del usuario cuando se creó la tarea.

Un día pasado puede cambiar de fallado a cumplido mucho después. El `upsert` de
`habit_logs` con `onConflict: "habit_id,log_date"` sobrescribe el `missed` que el
backfill hubiera puesto, así que el calendario se repinta solo.

Queda un hueco conocido: cambiar el `due_date` de una tarea vinculada desde el
`PATCH` no resincroniza ni el día viejo ni el nuevo.
