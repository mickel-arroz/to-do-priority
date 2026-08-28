# El consejo nunca reparte 24 horas al día

Todo prompt de la generación diaria lleva un presupuesto de tiempo. Sin él la IA
aconseja como si el día entero estuviera libre y propone cargas que no caben en
ninguna vida real, que es justo lo que hace inútil un consejo.

El presupuesto tiene dos capas. La primera es fija y no se le pregunta a nadie: unas
7 horas de sueño, así que como mucho existen 16 o 17 horas despiertas. La segunda es
el tiempo ocupado que el usuario configura (`busy_blocks`): los tramos de su semana
tipo comprometidos fuera de la app. Sin nada configurado sólo aplica la primera.

Se descartó modelar esto como una agenda. La app no muestra los bloques en ningún
calendario, no avisa de choques y no los cruza con las fechas de vencimiento: son
una semana tipo, no eventos. Su único consumidor es el prompt, y por eso viajan
resumidos en horas por día (`lib/availability.ts`) en vez de crudos.

Las horas ocupadas se restan sobre el mismo día que las declara, aunque caigan de
madrugada y se solapen con el sueño. Es una resta que tira a la baja a propósito:
prometer tiempo de más es peor que quedarse corto.
