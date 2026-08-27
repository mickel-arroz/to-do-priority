# El día se define en la zona horaria del usuario, no la del servidor

La caducidad de un consejo se evalúa contra el día del usuario, resuelto por
`getUserToday()` (cookie `tz` → cabecera `x-vercel-ip-timezone` → zona de la máquina), igual
que ya se resuelven las tareas vencidas, la ventana de completadas y las rachas.

Se pidió expresamente usar la zona del servidor donde se despliega el proyecto, y se
descartó: en Vercel esa zona es UTC, así que un usuario en UTC−4 vería su consejo cambiar a
las 8 de la tarde mientras el resto de la app sigue en el día anterior. Peor aún, ese
consejo se habría generado con las tareas de hoy y se presentaría como el de mañana.
Coherencia con el resto de la app pesó más que la literalidad de la petición.
