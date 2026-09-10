# El "atrás" cierra la modal, y su centinela se abandona al navegar

Cada modal abierta empuja una entrada centinela en el historial con `pushState`
**sin url**, de modo que la barra de direcciones no se mueve. El "atrás" del
usuario consume ese centinela y el listener cierra la modal de encima, así que
el gesto se gasta en la modal y no en la pantalla. Al cerrarla por cualquier
otra vía —la X, Escape, guardar— se consume la entrada con un único
`history.go` de la diferencia exacta, para no dejar un "atrás" muerto.

El hook vive en el **Root** de `Dialog`, `AlertDialog` y `Sheet`, no en el
`Content`: el Content desmonta con retraso por la animación de salida, y un
cierre rechazado por `useLockedOpenChange` no llega nunca hasta él. Desde el
Root se ve `open` y el setter, así que el rechazo es observable y el centinela
se repone. Los tres Roots controlan la apertura siempre por dentro, lo que
permite cerrar incluso las modales que se abren con un Trigger y no reciben
`onOpenChange`, sin tocar ninguna call site.

La profundidad se guarda dentro del estado de cada entrada
(`history.state.__modalHistory`) y se relee en cada operación, en vez de
mantener un contador en memoria. Por eso una recarga, una ruta empujada por
Next o el doble efecto de StrictMode no pueden desincronizar la cuenta: una
entrada que no es nuestra lee 0.

## La regla que parece redundante

**Cuando hay una navegación en marcha, el centinela sobrante se abandona en vez
de consumirse.** Es lo que hace `notifyModalNavigation()`, y hay que llamarlo en
todo sitio que navegue con una modal abierta: los `<Link>` del menú móvil y los
`router.push` de cerrar sesión, borrar una lista y borrar un hábito.

Sin esa llamada hay una carrera real: `history.go` es asíncrono, y si Next
empuja la ruta nueva entre la llamada y la traversal, el salto se resuelve ya
sobre esa ruta y **echa al usuario de ella**. No es teórico — la navegación
principal en móvil son `<Link>` dentro del Sheet del menú, con rutas
prefetchadas que commitean rápido.

El precio de abandonarlo es una entrada de más con la URL de la pantalla
anterior: un "atrás" que no cambia nada visible. Mucho más barato que una
navegación fantasma.

## Considered Options

Un `<ModalHistoryProvider>` con la pila en Context. Se descartó porque haría
falta un listener de `popstate` por instancia, y el `history.go` de una modal
hija despertaría también al handler de la padre. El estado que se gestiona
(`window.history`) ya es un singleton del cliente, así que el Context sólo
añadiría ceremonia.

Una ref booleana de "cerrando programáticamente" para no reaccionar al popstate
que provocamos nosotros. Se descartó porque se queda pegada si el `go` no
produce popstate (delta fuera de rango, traversal bloqueada) y entonces se come
el siguiente "atrás" real. La comparación `depthOf(event.state) < stack.length`
distingue los dos casos sin estado extra y no tiene ese modo de fallo.

## Consequences

El handler de `popstate` del app router de Next sigue ejecutándose en cada
"atrás" —el nuestro se registra después y no puede adelantarlo—, así que cada
cierre pasa por un `dispatchTraverseAction` a la misma URL y con el mismo árbol.

Un traversal de varios pasos a la vez (mantener pulsado atrás) cierra sólo una
modal y repone el resto de centinelas: se queda corto, pero nunca navega mal.

Esto no se puede probar en Vitest: jsdom no despacha `popstate` de forma fiable
ante `history.go`. La cobertura vive en `tests/e2e/modal-back.spec.ts` y en
`tests/e2e/mobile.spec.ts`.
