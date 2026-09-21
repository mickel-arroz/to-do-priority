# Un día sin tarea vencida es neutro, no fallado

Un día del hábito en el que no vencía ninguna tarea vinculada no es ni cumplido
ni fallado: es un día que el hábito no pedía. No suma progreso, no resta con el
castigo, no rompe la racha, no entra en el denominador de la tasa de
cumplimiento y el calendario lo pinta en gris, distinto del rojo de un día
fallado.

Qué días pedían algo se deriva en lectura del `due_date` de las tareas
vinculadas, con cada instancia recurrente, igual que `isHabitDayCompleted`
juzga un día por las tareas que vencían en él (ADR 0005). Las tres funciones
puras de `lib/habits.ts` —`computeHabitProgress`, `buildCalendarData` y
`buildChartSeries`— reciben por eso las tareas vinculadas además de los logs.

## Considered Options

Seguir tratando cualquier día sin log `completed` como fallado, que es como
estaba escrito. Se descartó porque un hábito vinculado a una tarea no diaria no
podía progresar: con castigo, una tarea semanal cumplida sin fallar sumaba 1 el
lunes y restaba 12 el resto de la semana, y el progreso se quedaba clavado en 0;
sin castigo, la tasa de un cumplimiento perfecto marcaba 14 % y el calendario
pintaba seis días rojos por semana.

Escribir un tercer estado en `habit_logs` para los días neutros. Se descartó
porque exige una migración del enum, porque nadie toca esos días para
escribirlos —haría falta un backfill como el de `missed`, que ya arrastra sus
propios problemas— y porque la regla quedaría repartida entre la base y el
código en vez de vivir en un solo sitio.

Contar los días neutros como cumplidos. Se descartó porque regalaría progreso
por no hacer nada: un hábito con una tarea única llegaría a su objetivo sin
tocar nada más.

## Consequences

El listado de hábitos necesita ahora, además de los logs, el vencimiento de
cada tarea vinculada de cada hábito, en cualquier estado. Es una fila por
instancia, la misma forma que ya tiene la tabla de logs.

Un hábito vinculado sólo a tareas puntuales progresa sólo en esos días y marca
100 % si las cumple; el resto del rango queda neutro. Es lo que se quiere:
el hábito mide lo que se le pidió, no el calendario.

Hoy sin ninguna tarea vencida es también neutro: no se pinta como pendiente,
porque no hay nada pendiente.

Las filas `missed` del backfill dejan de tener ningún efecto en el calendario,
que ya derivaba el rojo de comparar fechas y ahora además exige que el día
pidiera algo. El backfill se borra en el ADR 0009.
