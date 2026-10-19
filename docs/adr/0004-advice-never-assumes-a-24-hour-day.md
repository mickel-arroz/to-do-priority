# El consejo nunca reparte 24 horas al día

Todo prompt de la generación diaria lleva un presupuesto de tiempo. Sin él la IA
aconseja como si el día entero estuviera libre y propone cargas que no caben en
ninguna vida real, que es justo lo que hace inútil un consejo.

El presupuesto tiene dos capas. La primera es el sueño, que se descuenta siempre:
las horas que el usuario elige en el diálogo de disponibilidad
(`profiles.sleep_hours`, enteras de 0 a 24) o 7 si nunca las cambió. La segunda es
el tiempo ocupado que el usuario configura (`busy_blocks`): los tramos de su semana
tipo comprometidos fuera de la app. Sin tiempo ocupado sólo aplica la primera.

Al principio el sueño era un supuesto fijo de 7 horas que no se le preguntaba a
nadie. Se hizo configurable porque quien duerme 9 o 5 horas tiene otro día, y
el consejo debe razonar sobre el suyo. Se admite 24 aunque no sea lo normal: deja
el día sin tiempo libre y la IA lo trata como tal.

Se descartó modelar esto como una agenda. La app no muestra los bloques en ningún
calendario, no avisa de choques y no los cruza con las fechas de vencimiento: son
una semana tipo, no eventos. Su único consumidor es el prompt, y por eso viajan
resumidos en horas por día (`lib/availability.ts`) en vez de crudos.

Las horas ocupadas se restan sobre el mismo día que las declara, aunque caigan de
madrugada y se solapen con el sueño. Es una resta que tira a la baja a propósito:
prometer tiempo de más es peor que quedarse corto.
