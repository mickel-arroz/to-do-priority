"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, RotateCcw, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormFieldset, useLockedOpenChange } from "@/components/ui/busy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/error-message";
import {
  MAX_BLOCKS_PER_DAY,
  MINUTES_IN_DAY,
  WEEK_ORDER,
  minutesToTime,
  normalizeBusyBlocks,
  timeToMinutes,
  type BusyBlockInput,
  type Weekday,
} from "@/lib/availability";
import { useT } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

/** Un tramo mientras se edita: minutos, sin dia (lo pone la fila que lo contiene). */
type Draft = { start: number; end: number };
type Week = Record<number, Draft[]>;

/** Clave de diccionario por indice de dia, con `getDay()` como convencion. */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Jornada por defecto al marcar un dia como ocupado: 09:00 a 17:00. */
const DEFAULT_BLOCK: Draft = { start: 9 * 60, end: 17 * 60 };

function emptyWeek(): Week {
  return Object.fromEntries(WEEK_ORDER.map((d): [number, Draft[]] => [d, []]));
}

function toWeek(blocks: BusyBlockInput[]): Week {
  const week = emptyWeek();
  for (const block of blocks) {
    week[block.weekday]?.push({ start: block.start_minute, end: block.end_minute });
  }
  return week;
}

function toBlocks(week: Week): BusyBlockInput[] {
  return WEEK_ORDER.flatMap((weekday) =>
    week[weekday].map((b) => ({
      weekday,
      start_minute: b.start,
      end_minute: b.end,
    }))
  );
}

/**
 * `<input type="time">` no acepta "24:00", asi que el fin del dia se le
 * presenta como "00:00"; `timeToMinutes` hace el viaje de vuelta.
 */
function toInputValue(minutes: number): string {
  return minutesToTime(minutes === MINUTES_IN_DAY ? 0 : minutes);
}

function busyHours(blocks: Draft[]): number {
  const minutes = blocks.reduce((total, b) => total + Math.max(0, b.end - b.start), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * Disponibilidad del usuario: en que horas de una semana tipo esta ocupado
 * fuera de la app. No bloquea nada ni se pinta en ningun calendario; su unico
 * consumidor es el prompt de la generacion diaria, que usa esas horas para no
 * aconsejar como si el dia entero estuviera libre.
 *
 * Se edita y se guarda la semana completa de una vez, asi que "Restablecer" es
 * simplemente vaciarla: sin bloques, el usuario esta disponible 24/7.
 */
export function AvailabilityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [week, setWeek] = useState<Week>(emptyWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Derived-state-during-render: cada apertura empieza en blanco y vuelve a
  // pedir la semana, que pudo cambiar en otra pestana.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLoading(true);
      setWeek(emptyWeek());
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.availability
      .get()
      .then(({ blocks }) => {
        if (cancelled) return;
        setWeek(
          toWeek(
            blocks.map((b) => ({
              weekday: b.weekday,
              start_minute: b.start_minute,
              end_minute: b.end_minute,
            }))
          )
        );
      })
      .catch(() => {
        if (!cancelled) toast.error(t.common.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Solo al abrir: `t` cambia con el idioma y no debe volver a pedir la semana
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function updateDay(weekday: Weekday, blocks: Draft[]) {
    setWeek((prev) => ({ ...prev, [weekday]: blocks }));
  }

  function toggleDay(weekday: Weekday, busy: boolean) {
    updateDay(weekday, busy ? [{ ...DEFAULT_BLOCK }] : []);
  }

  function updateBlock(weekday: Weekday, index: number, patch: Partial<Draft>) {
    updateDay(
      weekday,
      week[weekday].map((b, i) => (i === index ? { ...b, ...patch } : b))
    );
  }

  function copyToAll(weekday: Weekday) {
    const source = week[weekday];
    setWeek(
      Object.fromEntries(
        WEEK_ORDER.map((d): [number, Draft[]] => [d, source.map((b) => ({ ...b }))])
      )
    );
  }

  // Un tramo con fin anterior o igual al inicio no se puede guardar: el usuario
  // esta a medio escribirlo, asi que se marca el campo en vez de corregirlo por
  // su cuenta.
  const invalid = WEEK_ORDER.some((d) => week[d].some((b) => b.end <= b.start));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) {
      toast.error(t.availability.invalidRange);
      return;
    }
    setSaving(true);
    try {
      await api.availability.save(normalizeBusyBlocks(toBlocks(week)));
      toast.success(t.availability.saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  const handleOpenChange = useLockedOpenChange(saving, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!saving}
        data-testid="availability-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t.availability.title}</DialogTitle>
          <DialogDescription>{t.availability.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FormFieldset busy={saving}>
            <div className="max-h-[52dvh] space-y-2 overflow-y-auto py-1 pr-1">
              {loading
                ? WEEK_ORDER.map((d) => <Skeleton key={d} className="h-[46px] w-full" />)
                : WEEK_ORDER.map((weekday) => {
                    const blocks = week[weekday];
                    const busy = blocks.length > 0;
                    return (
                      <div
                        key={weekday}
                        data-testid={`availability-day-${weekday}`}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          busy ? "bg-card" : "bg-muted/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`busy-${weekday}`}
                            checked={busy}
                            onCheckedChange={(v) => toggleDay(weekday, v)}
                            aria-label={t.availability.busyLabel}
                          />
                          <Label
                            htmlFor={`busy-${weekday}`}
                            className="flex-1 cursor-pointer"
                          >
                            {t.availability.days[DAY_KEYS[weekday]]}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {busy
                              ? `${busyHours(blocks)} ${t.availability.hoursBusy}`
                              : t.availability.freeDay}
                          </span>
                          {busy && (
                            <button
                              type="button"
                              onClick={() => copyToAll(weekday)}
                              title={t.availability.copyToAll}
                              aria-label={t.availability.copyToAll}
                              className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Copy className="size-4" />
                            </button>
                          )}
                        </div>

                        {busy && (
                          <div className="mt-3 space-y-2 pl-11">
                            {blocks.map((block, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Input
                                  type="time"
                                  step={900}
                                  aria-label={t.availability.from}
                                  value={toInputValue(block.start)}
                                  onChange={(e) => {
                                    const value = timeToMinutes(
                                      e.target.value,
                                      "start"
                                    );
                                    if (value !== null)
                                      updateBlock(weekday, index, { start: value });
                                  }}
                                  className="w-auto flex-1"
                                />
                                <span
                                  aria-hidden
                                  className="text-sm text-muted-foreground"
                                >
                                  &ndash;
                                </span>
                                <Input
                                  type="time"
                                  step={900}
                                  aria-label={t.availability.to}
                                  aria-invalid={block.end <= block.start}
                                  value={toInputValue(block.end)}
                                  onChange={(e) => {
                                    const value = timeToMinutes(e.target.value, "end");
                                    if (value !== null)
                                      updateBlock(weekday, index, { end: value });
                                  }}
                                  className="w-auto flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDay(
                                      weekday,
                                      blocks.filter((_, i) => i !== index)
                                    )
                                  }
                                  title={t.availability.removeBlock}
                                  aria-label={t.availability.removeBlock}
                                  className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-destructive"
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            ))}
                            {blocks.length < MAX_BLOCKS_PER_DAY && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateDay(weekday, [...blocks, { ...DEFAULT_BLOCK }])
                                }
                                className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <Plus className="size-3.5" />
                                {t.availability.addBlock}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>

            {/* Footer propio: "Restablecer" va a la izquierda y "Guardar" a la
                derecha, y DialogFooter alinea todo al final. */}
            <div className="-mx-4 -mb-4 mt-4 flex items-center justify-between gap-2 rounded-b-xl border-t bg-muted p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWeek(emptyWeek())}
                title={t.availability.resetHint}
                disabled={loading}
                data-testid="availability-reset"
              >
                <RotateCcw className="size-4" />
                {t.availability.reset}
              </Button>
              <LoadingButton
                type="submit"
                loading={saving}
                disabled={loading || invalid}
                data-testid="availability-save"
              >
                {t.common.save}
              </LoadingButton>
            </div>
          </FormFieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
