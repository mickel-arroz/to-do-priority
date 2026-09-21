# Los scrollbars finos van por `::-webkit-scrollbar`, no por las propiedades estándar

En desktop la app pinta una barra de scroll estrecha, sin botones de flecha y
con el track transparente, en ambos ejes y de forma global. La regla vive
entera en `app/globals.css`, dentro de `@media (pointer: fine)`: en táctil no
se toca nada, porque ahí el sistema ya usa scrollbars overlay que no reservan
hueco.

La vía es `::-webkit-scrollbar` y sus pseudoelementos. Las propiedades
estándar `scrollbar-width` / `scrollbar-color` quedan relegadas a un bloque
`@supports not selector(::-webkit-scrollbar)`, que en la práctica sólo alcanza
a Firefox.

## Por qué no las propiedades estándar, que es lo que uno esperaría

Por dos hechos comprobados en Chrome 14x sobre Windows, no por preferencia:

**`scrollbar-width: thin` adelgaza la barra pero sigue pintando las flechas.**
Es justo el requisito que motivaba el cambio, y no lo cumple. Con `thin` el
hueco baja a ~10 px y el botón de step sigue ahí arriba del todo.

**No se pueden combinar las dos vías.** Desde Chrome 121 las propiedades
estándar tienen prioridad y anulan por completo las reglas
`::-webkit-scrollbar` del mismo scroller. Declarar `scrollbar-width: thin`
"por si acaso" junto a los pseudoelementos no es defensa en profundidad: apaga
los pseudoelementos y devuelve las flechas. Por eso el bloque estándar va
detrás de un `@supports` que Chromium y WebKit no pasan, en vez de suelto.

El precio es que en `::-webkit-scrollbar` el navegador abandona el render
nativo: hay que pintar el pulgar a mano. Se hace con `--muted-foreground` a
baja opacidad, que sigue el tema en claro y oscuro sin fijar un gris literal.

## Considered Options

Sólo las propiedades estándar. Es la opción limpia y la que proponía el issue
#15, pero deja las flechas en Windows, que era el problema a resolver.

Sólo `::-webkit-scrollbar`, sin el bloque `@supports`. Más corto, y deja a
Firefox con el scrollbar grueso del sistema. El bloque estándar cuesta seis
líneas y cubre ese motor, así que se quedó.

## Consequences

El pulgar lleva color propio, así que un cambio de paleta que toque
`--muted-foreground` lo arrastra. Es lo que se quiere, pero significa que el
scrollbar ya no es "el del navegador".

Sin `::-webkit-scrollbar` el scroller es nativo y overlay; con él, Chromium
pinta una barra que reserva hueco. En desktop ya lo reservaba, así que no hay
salto de layout.

La ausencia de flechas no es consultable desde el DOM: ni el pulgar ni los
botones existen como nodos. Los tests de `tests/e2e/scrollbars.spec.ts` miden
el hueco que reserva la barra, que sí es medible, y la ausencia de flechas se
comprueba a ojo.
