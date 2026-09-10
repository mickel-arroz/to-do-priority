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
const FULL_SCREEN_ON_MOBILE =
  "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:overflow-y-auto max-sm:p-5 max-sm:data-open:zoom-in-100 max-sm:data-closed:zoom-out-100 max-sm:data-open:slide-in-from-bottom-4 max-sm:data-closed:slide-out-to-bottom-4"

function DialogContent({
  className,
  children,
  showCloseButton = true,
  fullScreenOnMobile = false,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Ocupa toda la pantalla bajo `sm`. Para formularios, no para confirmaciones. */
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
          fullScreenOnMobile && FULL_SCREEN_ON_MOBILE,
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
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
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
        // tocar el tamaño de cada botón en cada diálogo.
        "max-sm:p-5 max-sm:[&_[data-slot=button]]:h-11 max-sm:[&_[data-slot=button]]:w-full max-sm:[&_[data-slot=button]]:text-base max-sm:[&_[data-slot=button]]:mr-0",
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
