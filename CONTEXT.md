# To-Do Priority

Gestor de tareas construido alrededor de la matriz de prioridad de Eisenhower, con
seguimiento de hábitos, rachas, temporizador pomodoro y consejos diarios generados
por IA.

## Language

### Tareas

**Tarea**:
Una unidad de trabajo con fecha de vencimiento y una prioridad de 1 a 4 según la
matriz de Eisenhower.
_Avoid_: To-do, pendiente (como sustantivo), item

**Tarea vencida**:
Una tarea cuya fecha de vencimiento es anterior al día del usuario y que sigue sin
resolverse.
_Avoid_: Atrasada, expirada, overdue

**Tarea fallada**:
Una tarea que el usuario cerró explícitamente como no cumplida, distinta de una que
simplemente venció sin tocarse.
_Avoid_: Rechazada, cancelada

### Hábitos

**Hábito**:
Un compromiso recurrente cuyo cumplimiento se registra un día a la vez. En este
proyecto "meta" es el mismo concepto, no otro.
_Avoid_: Meta, objetivo, goal, challenge

**Hábito finito**:
Un hábito con un número de días objetivo o una fecha de fin, y por tanto con un
progreso que puede completarse.
_Avoid_: Hábito con meta, hábito cerrado

**Hábito indefinido**:
Un hábito sin días objetivo ni fecha de fin. No puede completarse y está exento de
castigo por días fallidos.
_Avoid_: Hábito abierto, hábito permanente

**Hábito terminado**:
Un hábito finito que ya alcanzó su objetivo o pasó su fecha de fin.
_Avoid_: Hábito cerrado, hábito archivado

**Racha**:
Días consecutivos de cumplimiento de un hábito.
_Avoid_: Cadena, streak, secuencia

### Consejos

**Consejo**:
Un párrafo breve generado por IA para un usuario en un día concreto, a partir de sus
tareas y hábitos reales. Existe en español e inglés y sólo se conserva el más
reciente.
_Avoid_: Tip, sugerencia, recomendación, insight

**Consejo de inicio**:
El consejo que resume la situación global del usuario: sus pendientes, lo vencido en
la última semana y lo que viene en la próxima.
_Avoid_: Consejo global, consejo genérico, consejo de home

**Consejo de hábito**:
El consejo asociado a un hábito concreto, basado en sus métricas y en las tareas
vinculadas a él.
_Avoid_: Consejo personalizado, consejo de meta

**Frase motivacional**:
Uno de los textos fijos que vienen escritos en el proyecto. No es un consejo: no lo
genera nadie ni depende de los datos del usuario. Se muestra cuando todavía no hay
consejo.
_Avoid_: Consejo por defecto, frase de respaldo, fallback

**Generación diaria**:
La única petición a la IA que se hace por usuario y por día, y de la que salen a la
vez el consejo de inicio y los consejos de todos sus hábitos activos.
_Avoid_: Refresco, sincronización, job

### Tiempo

**Tiempo ocupado**:
Los tramos horarios de una semana tipo en los que el usuario no está disponible
para sus tareas: el trabajo, las clases, lo que no vive en esta app. No bloquea
nada ni se pinta en ningún calendario; sólo alimenta el prompt.
_Avoid_: Agenda, horario, calendario, tiempo disponible

**Disponibilidad**:
Lo que le queda al usuario una vez descontados el sueño y su tiempo ocupado. Es
el tiempo sobre el que la IA aconseja, y por eso nunca son 24 horas: sin nada
configurado se asumen unas 16 o 17.
_Avoid_: Tiempo libre, capacidad, ancho de banda

**Día del usuario**:
La fecha vigente en la zona horaria del usuario, no la del servidor. Es la unidad que
decide si algo está vencido, si una racha sigue viva y si toca una nueva generación
diaria.
_Avoid_: Hoy, fecha del servidor, UTC
