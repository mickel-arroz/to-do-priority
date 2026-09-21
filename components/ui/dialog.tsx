"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useCoarsePointer } from "@/hooks/useCoarsePointer"
import { useModalOpenState } from "@/hooks/useModalHistory"
import { XIcon } from "lucide-react"

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  // La apertura se controla siempre desde aquí, también cuando el consumidor
  // no pasa `onOpenChange`: es lo que permite cerrar la modal desde el botón
  // "atrás" sin tocar ninguna call site.
  const [isOpen, setOpen] = useModalOpenState({ open, defaultOpen, onOpenChange })
  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      open={isOpen}
      onOpenChange={setOpen}
      {...props}
    />
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * En móvil el diálogo deja de ser una tarjeta flotante y ocupa la pantalla
 * entera. Hay que neutralizar a la vez posición, traslación y radio porque las
 * clases base son incondicionales, y cambiar el zoom por un deslizamiento, que
 * es lo que se espera de algo que cubre todo.
 */
const FULL_SCREEN_ON_MOBILE = [
  "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none",
  "max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
  "max-sm:[&_[data-slot=dialog-footer]]:rounded-none",
  "max-sm:data-open:zoom-in-100 max-sm:data-closed:zoom-out-100",
  "max-sm:data-open:slide-in-from-bottom-4 max-sm:data-closed:slide-out-to-bottom-4",
].join(" ")

/**
 * La columna de un diálogo de formulario: la cabecera y el pie se quedan fijos
 * y lo único que scrollea es el `DialogBody`, tanto en móvil como en escritorio.
 *
 * El margen lateral no lo pone el Content sino cada pieza por dentro, y por eso
 * la barra de scroll del cuerpo cae pegada al borde del diálogo en vez de
 * flotando a 4 de él; por lo mismo el pie ya no necesita sangrar con márgenes
 * negativos para llegar a los bordes.
 */
const FIXED_HEADER_AND_FOOTER = [
  "flex flex-col overflow-hidden p-0",
  "[&>[data-slot=dialog-header]]:shrink-0 [&>[data-slot=dialog-header]]:px-4 [&>[data-slot=dialog-header]]:pt-4",
  "[&_[data-slot=dialog-body]]:px-4",
  "[&_[data-slot=dialog-footer]]:mx-0 [&_[data-slot=dialog-footer]]:mb-0 [&_[data-slot=dialog-footer]]:shrink-0",
  // A pantalla completa todo respira un punto más, como el resto del móvil.
  "max-sm:[&>[data-slot=dialog-header]]:px-5 max-sm:[&>[data-slot=dialog-header]]:pt-5",
  "max-sm:[&_[data-slot=dialog-body]]:px-5",
  // La cabecera baja 1, y el cerrar con ella, para seguir centrado en su línea.
  "max-sm:[&>[data-slot=dialog-close]]:top-4",
].join(" ")

/**
 * La columna la lleva el `<form>`, el envoltorio real que queda entre el
 * `DialogContent` y el `DialogBody`: sin esto el cuerpo no tiene contra qué
 * crecer y el pie vuelve a irse con el scroll.
 */
const DIALOG_COLUMN = "flex min-h-0 flex-1 flex-col"

/**
 * El `<fieldset>` que envuelve el cuerpo y el pie, en cambio, tiene que
 * desaparecer del layout: un fieldset flex no le pasa a sus hijos la altura que
 * recibe, así que el cuerpo no encogía y el pie se salía del diálogo por abajo.
 * Con `contents` el cuerpo y el pie cuelgan directos de la columna del `<form>`,
 * y el fieldset sigue haciendo lo suyo: propagar el `disabled` y su `space-y`.
 */
const DIALOG_COLUMN_PASSTHROUGH = "contents"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  fullScreenOnMobile = false,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /**
   * Diálogo de formulario: cabecera y pie fijos con el cuerpo scrolleando, y
   * además a pantalla completa bajo `sm`. No para confirmaciones.
   */
  fullScreenOnMobile?: boolean
}) {
  const coarsePointer = useCoarsePointer()

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          fullScreenOnMobile && [FIXED_HEADER_AND_FOOTER, FULL_SCREEN_ON_MOBILE],
          className
        )}
        onOpenAutoFocus={(event) => {
          // En táctil, el foco automático de Radix levanta el teclado virtual
          // nada más abrir y tapa media pantalla. Que lo pida el usuario.
          if (coarsePointer) event.preventDefault()
          onOpenAutoFocus?.(event)
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          // Se queda en la esquina porque el Content nunca scrollea: a pantalla
          // completa el scroll vive en el `DialogBody`, no aquí.
          //
          // El `top` centra el botón (28) contra la línea del título, que
          // empieza en el padding superior del diálogo y mide lo que la fuente
          // porque va con `leading-none`: 16 + 16/2 - 14 en escritorio, y
          // 16 + 20/2 - 14 en móvil, donde el título crece a `text-xl`.
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2.5 right-2 max-sm:top-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

/**
 * El cuerpo del diálogo, y lo único que scrollea. Sólo tiene sentido dentro de
 * un Content con `fullScreenOnMobile`, que es el que monta la columna; en una
 * modal de confirmación no pinta nada y sobra.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted p-4 sm:flex-row sm:justify-end",
        // Área táctil: los botones del pie son h-8, muy por debajo de los ~44px
        // que necesita un pulgar. Se escalan desde aquí para no tener que
        // tocar el tamaño de cada botón en cada diálogo. Se apunta al elemento
        // y no a `[data-slot=button]` porque un `asChild` de Radix pisa ese
        // slot con el suyo —el borrar de la tarea es un AlertDialogTrigger— y
        // se quedaba pequeño y a media anchura entre dos botones enteros.
        "max-sm:p-5 max-sm:[&_button]:h-11 max-sm:[&_button]:w-full max-sm:[&_button]:text-base max-sm:[&_button]:mr-0",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium max-sm:text-xl",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DIALOG_COLUMN,
  DIALOG_COLUMN_PASSTHROUGH,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
