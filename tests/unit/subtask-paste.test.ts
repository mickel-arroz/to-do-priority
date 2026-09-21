import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/limits";
import { parsePastedSubtasks } from "@/lib/subtask-paste";

describe("parsePastedSubtasks: saltos de línea", () => {
  it("crea una subtarea por línea", () => {
    expect(parsePastedSubtasks("Comprar pan\nLlamar al banco")).toEqual([
      "Comprar pan",
      "Llamar al banco",
    ]);
  });

  it("descarta las líneas vacías o de solo espacios", () => {
    expect(parsePastedSubtasks("Uno\n\n   \nDos\n")).toEqual(["Uno", "Dos"]);
  });

  it("entiende los tres finales de línea", () => {
    expect(parsePastedSubtasks("Uno\r\nDos\rTres\nCuatro")).toEqual([
      "Uno",
      "Dos",
      "Tres",
      "Cuatro",
    ]);
  });

  it("recorta los espacios de cada línea", () => {
    expect(parsePastedSubtasks("  Uno  \n\tDos\t")).toEqual(["Uno", "Dos"]);
  });

  it("devuelve un solo elemento para una línea suelta", () => {
    expect(parsePastedSubtasks("Comprar pan")).toEqual(["Comprar pan"]);
  });

  it("devuelve la lista vacía para un texto sin contenido", () => {
    expect(parsePastedSubtasks("")).toEqual([]);
    expect(parsePastedSubtasks("  \n \n ")).toEqual([]);
  });
});

describe("parsePastedSubtasks: marcadores de lista", () => {
  it("quita guiones, asteriscos y signos de más", () => {
    expect(parsePastedSubtasks("- Uno\n* Dos\n+ Tres")).toEqual([
      "Uno",
      "Dos",
      "Tres",
    ]);
  });

  it("quita las viñetas unicode", () => {
    expect(parsePastedSubtasks("• Uno\n◦ Dos\n▪ Tres\n‣ Cuatro\n· Cinco")).toEqual(
      ["Uno", "Dos", "Tres", "Cuatro", "Cinco"]
    );
  });

  it("quita las rayas y los guiones largos", () => {
    expect(parsePastedSubtasks("– Uno\n— Dos")).toEqual(["Uno", "Dos"]);
  });

  it("quita la numeración", () => {
    expect(parsePastedSubtasks("1. Uno\n2) Dos\n3- Tres\n10. Diez")).toEqual([
      "Uno",
      "Dos",
      "Tres",
      "Diez",
    ]);
  });

  it("quita las casillas de markdown, marcadas o no", () => {
    expect(parsePastedSubtasks("- [ ] Uno\n- [x] Dos\n[X] Tres\n[ ] Cuatro")).toEqual(
      ["Uno", "Dos", "Tres", "Cuatro"]
    );
  });

  it("quita el marcador aunque la lista venga indentada o anidada", () => {
    expect(parsePastedSubtasks("- Uno\n    - Dos\n\t\t* Tres")).toEqual([
      "Uno",
      "Dos",
      "Tres",
    ]);
  });

  it("descarta una línea que solo trae el marcador", () => {
    expect(parsePastedSubtasks("- Uno\n-\n*  \nDos")).toEqual(["Uno", "Dos"]);
  });

  it("no toca lo que parece marcador pero no lo es", () => {
    // Todos se distinguen por no llevar un espacio detrás del supuesto
    // marcador, que es justo lo que separa una lista de un texto normal.
    expect(
      parsePastedSubtasks("-> Revisar el PR\n*negrita*\n-5 grados\n1.5 litros")
    ).toEqual(["-> Revisar el PR", "*negrita*", "-5 grados", "1.5 litros"]);
  });

  it("solo quita un marcador por línea", () => {
    expect(parsePastedSubtasks("- - Uno")).toEqual(["- Uno"]);
  });
});

describe("parsePastedSubtasks: tope de longitud", () => {
  const MAX = LIMITS.subtaskTitle;

  it("deja intacta una línea justo en el tope", () => {
    const line = "a".repeat(MAX);
    expect(parsePastedSubtasks(line)).toEqual([line]);
  });

  it("trunca al tope la línea que se pasa", () => {
    const [only] = parsePastedSubtasks("b".repeat(MAX + 50));
    expect(only).toBe("b".repeat(MAX));
  });

  it("mide el tope después de quitar el marcador", () => {
    const [only] = parsePastedSubtasks(`- ${"c".repeat(MAX)}`);
    expect(only).toBe("c".repeat(MAX));
  });

  it("no deja espacios colgando al truncar", () => {
    const [only] = parsePastedSubtasks(`${"d".repeat(MAX - 1)} eeee`);
    expect(only).toBe("d".repeat(MAX - 1));
  });
});
