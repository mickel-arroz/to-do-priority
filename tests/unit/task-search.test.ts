import { describe, expect, it } from "vitest";
import { MAX_RESULTS, MIN_QUERY_LENGTH, searchTasks } from "@/lib/task-search";
import type { Task } from "@/lib/types";

let seq = 0;
function task(partial: Partial<Task> & { subtaskTitles?: string[] } = {}): Task {
  seq += 1;
  const id = `t${seq}`;
  const { subtaskTitles = [], ...rest } = partial;
  return {
    id,
    user_id: "u1",
    category_id: "c1",
    title: `Sin relación ${seq}`,
    description: null,
    link: null,
    due_date: "2026-08-14",
    priority: 2,
    status: "pending",
    completed_at: null,
    pomodoro_minutes: 25,
    recurrence_type: "none",
    recurrence_weekdays: null,
    recurrence_interval: 1,
    recurrence_parent_id: null,
    created_at: "",
    updated_at: "",
    subtasks: subtaskTitles.map((title, i) => ({
      id: `${id}-s${i}`,
      task_id: id,
      title,
      is_done: false,
      position: i,
    })),
    task_images: [],
    ...rest,
  };
}

const titles = (results: Task[]) => results.map((t) => t.title);

describe("searchTasks", () => {
  it("encuentra por título exacto", () => {
    const regar = task({ title: "Regar las plantas" });
    const dentista = task({ title: "Pedir cita con el dentista" });

    expect(searchTasks([dentista, regar], "regar")).toEqual([regar]);
  });

  it("tolera erratas", () => {
    const tarea = task({ title: "Revisar la tarea de mate" });

    expect(searchTasks([tarea], "tarae")).toEqual([tarea]);
  });

  it("ignora acentos y mayúsculas en ambos sentidos", () => {
    const camion = task({ title: "Llevar el camión al taller" });
    const cancion = task({ title: "Ensayar la cancion" });

    expect(searchTasks([camion], "CAMION")).toEqual([camion]);
    expect(searchTasks([cancion], "canción")).toEqual([cancion]);
  });

  it("acepta términos incompletos", () => {
    const presupuesto = task({ title: "Cerrar el presupuesto anual" });

    expect(searchTasks([presupuesto], "presup")).toEqual([presupuesto]);
  });

  it("no devuelve lo que no se parece", () => {
    expect(searchTasks([task({ title: "Pagar la luz" })], "dentista")).toEqual([]);
  });

  it("ordena por grupos: título, luego descripción, luego subtareas", () => {
    const bySubtask = task({ title: "Compras", subtaskTitles: ["Leche", "Factura"] });
    const byDescription = task({
      title: "Llamar al banco",
      description: "Preguntar por la factura del mes",
    });
    const byTitle = task({ title: "Pagar la factura" });

    expect(searchTasks([bySubtask, byDescription, byTitle], "factura")).toEqual([
      byTitle,
      byDescription,
      bySubtask,
    ]);
  });

  it("el grupo manda sobre el parecido: un título aproximado va antes que una descripción exacta", () => {
    const exactDescription = task({ title: "Otra cosa", description: "factura" });
    const fuzzyTitle = task({ title: "Pagar la factur" });

    expect(searchTasks([exactDescription, fuzzyTitle], "factura")).toEqual([
      fuzzyTitle,
      exactDescription,
    ]);
  });

  it("una tarea que coincide por título y descripción sale una sola vez, en el grupo del título", () => {
    const both = task({ title: "Factura", description: "factura de la luz" });
    const onlyDescription = task({ title: "Otra cosa", description: "factura" });

    expect(searchTasks([onlyDescription, both], "factura")).toEqual([
      both,
      onlyDescription,
    ]);
  });

  it("dentro de un grupo, lo más parecido va primero", () => {
    const fuzzy = task({ title: "Facturo" });
    const exact = task({ title: "Factura" });

    expect(titles(searchTasks([fuzzy, exact], "factura"))).toEqual([
      "Factura",
      "Facturo",
    ]);
  });

  it(`con menos de ${MIN_QUERY_LENGTH} caracteres no busca`, () => {
    const a = task({ title: "a" });

    expect(searchTasks([a], "a")).toEqual([]);
    expect(searchTasks([a], "  a  ")).toEqual([]);
    expect(searchTasks([a], "")).toEqual([]);
  });

  it(`devuelve como máximo ${MAX_RESULTS} resultados`, () => {
    const many = Array.from({ length: MAX_RESULTS + 5 }, (_, i) =>
      task({ title: `Factura ${i}` })
    );

    expect(searchTasks(many, "factura")).toHaveLength(MAX_RESULTS);
  });

  it("el máximo respeta el orden por grupos", () => {
    const bySubtask = task({ title: "Compras", subtaskTitles: ["Factura"] });
    const byTitle = Array.from({ length: MAX_RESULTS }, (_, i) =>
      task({ title: `Factura ${i}` })
    );

    expect(searchTasks([bySubtask, ...byTitle], "factura")).not.toContain(bySubtask);
  });
});
