"use client";

import * as React from "react";

/**
 * Hace que el botón o el gesto de "atrás" cierre la modal de encima en vez de
 * navegar, sin que la URL visible cambie nunca.
 *
 * Cada modal abierta empuja una entrada centinela con `pushState` sin url, así
 * que la barra de direcciones no se mueve. Cuando el usuario da atrás, el
 * navegador consume ese centinela y nosotros cerramos la modal de encima: el
 * "atrás" se gasta en la modal y no en la pantalla.
 *
 * La profundidad viaja DENTRO del estado de cada entrada
 * (`history.state.__modalHistory`), no en un contador de este módulo. Releer la
 * verdad del historial en lugar de recordarla es lo que evita que una recarga,
 * una navegación de Next o el doble efecto de StrictMode dejen la cuenta
 * desincronizada: una entrada que no es nuestra simplemente lee 0.
 *
 * Next parchea `history.pushState` para copiar sus internals (`__NA` y el árbol
 * de rutas) en la entrada nueva. Hay que empujar con el pushState parcheado y
 * SIN url: sin `__NA` el popstate del app router recargaría la página entera, y
 * con url dispararía un ACTION_RESTORE que no queremos.
 */

/** Clave con la que marcamos, y reconocemos, nuestras entradas del historial. */
const DEPTH_KEY = "__modalHistory";

type ModalEntry = {
  /** Pide el cierre por la misma vía que la X, respetando los bloqueos. */
  requestClose: () => void;
  /** Fuerza un render del hook para que reconcilie tras un cierre rechazado. */
  notify: () => void;
};

/** Modales abiertas, de la de más abajo a la de encima. */
const stack: ModalEntry[] = [];

let listening = false;
let syncScheduled = false;

/** Hay una navegación en marcha; el próximo centinela sobrante se abandona. */
let navigating = false;

function depthOf(state: unknown): number {
  if (typeof state !== "object" || state === null) return 0;
  const depth = (state as Record<string, unknown>)[DEPTH_KEY];
  return typeof depth === "number" ? depth : 0;
}

/**
 * Iguala el número de centinelas al número de modales abiertas.
 *
 * Se agrupa en un microtask y siempre se llama desde un efecto, de modo que
 * `stack` ya refleja la verdad y el registrar → desregistrar → registrar de
 * StrictMode se colapsa en cero operaciones de historial.
 */
function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => {
    syncScheduled = false;
    sync();
  });
}

function sync() {
  const want = stack.length;
  const have = depthOf(window.history.state);
  const skipBack = navigating;
  navigating = false;

  if (have === want) return;

  if (have < want) {
    // Faltan centinelas: o se acaba de abrir una modal, o el usuario dio atrás,
    // el cierre se rechazó y hay que reponer el que el navegador ya consumió.
    for (let depth = have + 1; depth <= want; depth++) {
      window.history.pushState({ [DEPTH_KEY]: depth }, "");
    }
    return;
  }

  // Sobran centinelas: la modal se cerró con la X, Escape, Cancelar o al
  // guardar. Hay que gastar la entrada que metimos nosotros para que el
  // siguiente "atrás" del usuario le lleve a la pantalla anterior de verdad.
  //
  // Salvo que haya una navegación en marcha: `history.go` es asíncrono y si la
  // navegación gana la carrera el salto se aplicaría ya sobre la página nueva y
  // echaría al usuario de ella (ver `notifyModalNavigation`).
  if (skipBack) return;
  window.history.go(want - have);
}

function onPopState(event: PopStateEvent) {
  const have = depthOf(event.state);

  // `have < stack.length` es la firma exacta de un "atrás" del usuario contra
  // una modal: el navegador acaba de comerse un centinela nuestro. Cualquier
  // otra combinación sobra, incluido el popstate de nuestro propio
  // `history.go`, que llega cuando la pila ya se ha encogido. Esta comparación
  // es toda la guarda de "cerrando programáticamente": no hace falta ningún
  // flag, que además se quedaría pegado si un `go` no produjera popstate.
  if (stack.length === 0 || have >= stack.length) return;

  const top = stack[stack.length - 1];
  top.requestClose();
  // Si el cierre se rechaza, `open` no cambia y nadie reconciliaría; este aviso
  // garantiza que el hook vuelva a entrar en su efecto y reponga el centinela.
  top.notify();
}

function register(entry: ModalEntry) {
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  stack.push(entry);
}

function unregister(entry: ModalEntry) {
  const index = stack.indexOf(entry);
  if (index !== -1) stack.splice(index, 1);
}

/**
 * Avisa de que va a haber una navegación con una modal abierta: un `<Link>` del
 * menú móvil, o el `router.push` que se hace tras borrar una lista o un hábito.
 * El centinela de esa modal se abandona en vez de gastarse, porque el
 * `history.go` es asíncrono y podría ejecutarse cuando Next ya ha empujado la
 * ruta nueva, sacando al usuario de ella.
 *
 * El precio es una entrada de más con la URL de la pantalla anterior: un
 * "atrás" que no cambia nada visible. Mucho más barato que una navegación
 * fantasma. Ver `docs/adr/0006-modal-back-button.md`.
 */
export function notifyModalNavigation() {
  navigating = true;
}

/**
 * Registra una modal abierta en el historial. `onRequestClose` tiene que pedir
 * el cierre por la vía normal (la misma que la X), no forzarlo: si el
 * consumidor lo rechaza —`useLockedOpenChange` durante un guardado—, `open`
 * sigue en `true` y el hook repone el centinela por su cuenta.
 */
export function useModalHistory(open: boolean, onRequestClose: () => void) {
  // Sólo sirve para volver a entrar en el efecto cuando el cierre se rechaza:
  // en ese caso `open` no cambia y sin esto nadie reconciliaría.
  const [tick, bump] = React.useReducer((n: number) => n + 1, 0);
  const entryRef = React.useRef<ModalEntry | null>(null);
  const closeRef = React.useRef(onRequestClose);

  React.useEffect(() => {
    closeRef.current = onRequestClose;
  });

  React.useEffect(() => {
    // `tick` está en las dependencias sólo para reejecutar tras un rechazo.
    void tick;

    if (open && entryRef.current === null) {
      entryRef.current = {
        requestClose: () => closeRef.current(),
        notify: bump,
      };
      register(entryRef.current);
      scheduleSync();
      return;
    }

    if (!open && entryRef.current !== null) {
      unregister(entryRef.current);
      entryRef.current = null;
      scheduleSync();
      return;
    }

    // Sigue abierta después de un "atrás": el cierre se rechazó y hay que
    // devolver al historial el centinela que el navegador ya consumió.
    if (open) scheduleSync();
  }, [open, tick]);

  // Desmontarse con la modal abierta (un cambio de ruta, por ejemplo) cuenta
  // como cerrarla. Va en su propio efecto sin dependencias para que sólo corra
  // al desmontar de verdad, no en cada cambio de `open`.
  React.useEffect(
    () => () => {
      if (entryRef.current === null) return;
      unregister(entryRef.current);
      entryRef.current = null;
      scheduleSync();
    },
    []
  );
}

type ModalOpenStateProps = {
  open?: boolean | undefined;
  defaultOpen?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
};

/**
 * Estado de apertura que se comporta igual esté o no controlado desde fuera, y
 * que ya viene enganchado al historial.
 *
 * Controlarlo siempre por dentro es lo que permite pedir el cierre en las
 * modales que se abren con un Trigger y no reciben `onOpenChange` —el
 * AlertDialog de borrar tarea dentro de TaskFormDialog—, sin obligar a
 * convertirlas en controladas en la call site.
 */
export function useModalOpenState({
  open,
  defaultOpen,
  onOpenChange,
}: ModalOpenStateProps): [boolean, (open: boolean) => void] {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChangeRef.current?.(next);
    },
    [isControlled]
  );

  const requestClose = React.useCallback(() => setOpen(false), [setOpen]);
  useModalHistory(isOpen, requestClose);

  return [isOpen, setOpen];
}
