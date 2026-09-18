import { describe, expect, it } from "vitest";
import { dueDayLabel } from "@/lib/due-date";
import { getDictionary } from "@/lib/i18n";

const TODAY = "2026-08-14";
const es = getDictionary("es");
const en = getDictionary("en");

describe("dueDayLabel", () => {
  it("names the user's day", () => {
    expect(dueDayLabel(TODAY, TODAY, es)).toBe("Hoy");
  });

  it("names the previous day", () => {
    expect(dueDayLabel("2026-08-13", TODAY, es)).toBe("Ayer");
  });

  it("names the next day", () => {
    expect(dueDayLabel("2026-08-15", TODAY, es)).toBe("Mañana");
  });

  it("names those same days in English", () => {
    expect(dueDayLabel("2026-08-13", TODAY, en)).toBe("Yesterday");
    expect(dueDayLabel(TODAY, TODAY, en)).toBe("Today");
    expect(dueDayLabel("2026-08-15", TODAY, en)).toBe("Tomorrow");
  });

  it("returns null for any other date", () => {
    expect(dueDayLabel("2026-08-12", TODAY, es)).toBeNull();
    expect(dueDayLabel("2026-08-16", TODAY, es)).toBeNull();
    expect(dueDayLabel("2025-08-14", TODAY, es)).toBeNull();
  });

  it("crosses month boundaries", () => {
    expect(dueDayLabel("2026-07-31", "2026-08-01", es)).toBe("Ayer");
    expect(dueDayLabel("2026-09-01", "2026-08-31", es)).toBe("Mañana");
  });

  it("crosses year boundaries", () => {
    expect(dueDayLabel("2025-12-31", "2026-01-01", es)).toBe("Ayer");
    expect(dueDayLabel("2027-01-01", "2026-12-31", es)).toBe("Mañana");
  });

  it("crosses a leap day", () => {
    expect(dueDayLabel("2028-02-29", "2028-03-01", es)).toBe("Ayer");
    expect(dueDayLabel("2028-02-29", "2028-02-28", es)).toBe("Mañana");
  });
});
