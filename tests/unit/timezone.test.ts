import { describe, expect, it } from "vitest";
import { isWithinRange, userDayRange } from "@/lib/timezone";

describe("userDayRange", () => {
  it("va del inicio del día del usuario al inicio del siguiente, con su offset", () => {
    expect(userDayRange("2026-10-12", "America/Caracas")).toEqual({
      start: "2026-10-12T00:00:00-04:00",
      end: "2026-10-13T00:00:00-04:00",
    });
  });

  it("usa Z en UTC", () => {
    expect(userDayRange("2026-10-12", "UTC")).toEqual({
      start: "2026-10-12T00:00:00Z",
      end: "2026-10-13T00:00:00Z",
    });
  });

  it("cada extremo lleva su propio offset en un cambio de horario", () => {
    // Madrid pasa de +02:00 a +01:00 la madrugada del 25 de octubre de 2026.
    expect(userDayRange("2026-10-25", "Europe/Madrid")).toEqual({
      start: "2026-10-25T00:00:00+02:00",
      end: "2026-10-26T00:00:00+01:00",
    });
  });

  it("cruza bien el fin de mes y de año", () => {
    expect(userDayRange("2026-12-31", "Asia/Kolkata").end).toBe(
      "2027-01-01T00:00:00+05:30"
    );
  });
});

describe("isWithinRange", () => {
  const range = userDayRange("2026-10-12", "America/Caracas");

  it("deja fuera lo cerrado a las 21:00 del día anterior en UTC−4", () => {
    // 21:00 del 11 en Caracas = 01:00 UTC del 12: antes de medianoche UTC sí
    // contaba, que era justo el error.
    expect(isWithinRange("2026-10-12T01:00:00Z", range)).toBe(false);
  });

  it("incluye el inicio y excluye el inicio del día siguiente", () => {
    expect(isWithinRange("2026-10-12T04:00:00Z", range)).toBe(true);
    expect(isWithinRange("2026-10-13T03:59:59Z", range)).toBe(true);
    expect(isWithinRange("2026-10-13T04:00:00Z", range)).toBe(false);
  });

  it("compara instantes aunque vengan con otro offset", () => {
    expect(isWithinRange("2026-10-12T00:30:00-04:00", range)).toBe(true);
  });
});
