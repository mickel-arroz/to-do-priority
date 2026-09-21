# `habit_logs` sólo guarda días acreditados

Una fila en `habit_logs` significa una sola cosa: ese día del hábito quedó
cumplido. Los días fallados y los neutros no se escriben en ningún sitio; se
derivan en lectura comparando el día con las tareas vinculadas que vencían en
él (ADR 0005 y ADR 0008). El enum `habit_log_status` queda con el único valor
`completed` (migración `0010`).

Se borran el backfill `POST /api/habits/[id]/logs`, el `useEffect` del detalle
que lo disparaba en cada visita y `api.habits.syncMissed`.

## Considered Options

Mantener el backfill y arreglarlo: calcular "ayer" con `getUserToday()` en vez
de con la zona del servidor, y hacer que el calendario lea las filas `missed`.
Se descartó porque tras el ADR 0008 un día sin log no es necesariamente
fallado —puede ser neutro—, así que una fila `missed` escrita por fechas
seguiría sin poder decidir el color del día; la única fuente que puede son las
tareas vinculadas, que ya se leen.

Dejarlo como estaba. Se descartó porque escribía una fila por día sin log en
cada visita al detalle, nadie leía esas filas, y calculaba "hoy" con
`new Date()` del servidor, contra el ADR 0003: para un usuario en UTC−4 por la
tarde su hoy en curso se marcaba como fallado.

## Consequences

La migración `0010` tiene que correr antes de desplegar el código, o junto con
él: si quedaran filas `missed` en la base con el enum viejo, el único guardián
es el filtro por `status` de `lib/habits.ts`, que se conserva por eso mismo.

Se elimina la única lectura de `new Date()` como día del usuario que quedaba
en las rutas de hábitos.

`habit_logs` deja de crecer un día por hábito y día; sólo crece con los días
que se cumplen.

La columna `status` se conserva con un único valor posible por no tocar más
superficie de la necesaria; si algún día hace falta otro estado guardado, el
enum sigue ahí.
