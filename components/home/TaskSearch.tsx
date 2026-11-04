"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import { CompletedTaskRow } from "@/components/tasks/CompletedTaskRow";
import { TaskRowConnected, useTaskBoard } from "@/components/tasks/TaskBoard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/locale-context";
import { MIN_QUERY_LENGTH, searchTasks } from "@/lib/task-search";
import type { Task } from "@/lib/types";

/** Pausa desde la última tecla antes de buscar, para que la lista no salte. */
const SEARCH_DELAY_MS = 200;

/**
 * La lupa de la home y su modal: búsqueda difusa en memoria sobre las tareas
 * pendientes que el tablero ya tiene cargadas, sin pedir nada al servidor.
 */
export function TaskSearch() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t.tasks.searchTasks}
        title={t.tasks.searchTasks}
        data-testid="search-button"
      >
        <Search className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          fullScreenOnMobile
          className="sm:max-h-[80dvh] sm:max-w-xl"
          onOpenAutoFocus={(event) => {
            // Aquí el teclado sí se quiere de inmediato, también en táctil:
            // abrir la búsqueda es para escribir
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <SearchPanel inputRef={inputRef} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Vive dentro del contenido del diálogo, que se desmonta al cerrar: cada
 * apertura empieza con el campo vacío y se recalcula desde las pendientes
 * actuales.
 */
function SearchPanel({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const t = useT();
  const board = useTaskBoard();
  const [text, setText] = useState("");
  // Los resultados se fijan al buscar y no siguen al tablero: mientras el
  // texto no cambie, una tarea completada desde aquí se queda en la lista
  const [search, setSearch] = useState<{ query: string; results: Task[] }>({
    query: "",
    results: [],
  });

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tasksRef = useRef(board.tasks);
  useEffect(() => {
    tasksRef.current = board.tasks;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSearch({ query: value, results: searchTasks(tasksRef.current, value) });
    }, SEARCH_DELAY_MS);
  }

  const searching = search.query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <>
      <DialogHeader className="pr-12">
        <DialogTitle>{t.tasks.searchTasks}</DialogTitle>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t.tasks.searchPlaceholder}
            aria-label={t.tasks.searchTasks}
            className="h-10 pl-8"
            data-testid="search-input"
          />
        </div>
      </DialogHeader>

      <DialogBody className="pb-4">
        {!searching ? (
          <p
            className="py-6 text-center text-sm text-muted-foreground"
            data-testid="search-hint"
          >
            {t.tasks.searchHint(MIN_QUERY_LENGTH)}
          </p>
        ) : search.results.length === 0 ? (
          <p
            className="py-6 text-center text-sm text-muted-foreground"
            data-testid="search-empty"
          >
            {t.common.noResults}
          </p>
        ) : (
          <div className="space-y-2 py-1" data-testid="search-results">
            {search.results.map((task) => (
              <SearchResult key={task.id} task={task} />
            ))}
          </div>
        )}
      </DialogBody>
    </>
  );
}

/**
 * Un resultado tal como está ahora en el tablero: pendiente, la fila de
 * siempre con sus gestos; cerrada desde aquí, atenuada y con su estado. Si ya
 * no está en ninguna de las dos listas (se borró), desaparece.
 */
function SearchResult({ task }: { task: Task }) {
  const board = useTaskBoard();
  const pending = board.tasks.find((t) => t.id === task.id);
  const closed = pending
    ? undefined
    : board.completedToday.find((t) => t.id === task.id);
  const current = pending ?? closed;
  if (!current) return null;

  return (
    <div
      data-testid={`search-result-${task.id}`}
      data-status={current.status}
      className={closed ? "opacity-60" : undefined}
    >
      {/* Tipos distintos: volver a pendiente monta una fila nueva, sin la
          animación de salida del gesto anterior */}
      {pending ? (
        <TaskRowConnected task={pending} />
      ) : (
        <CompletedTaskRow task={current} />
      )}
    </div>
  );
}
