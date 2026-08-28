import { describe, expect, it } from "vitest";
import {
  MINUTES_IN_DAY,
  SLEEP_HOURS,
  minutesToTime,
  normalizeBusyBlocks,
  summarizeAvailability,
  timeToMinutes,
} from "@/lib/availability";

function block(weekday: number, start: number, end: number) {
  return { weekday, start_minute: start, end_minute: end };
}

const h = (hours: number) => hours * 60;

describe("timeToMinutes / minutesToTime", () => {
  it("round-trips a plain time", () => {
    expect(timeToMinutes("08:30", "start")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
  });

  it("reads midnight as the end of the day only in the end field", () => {
    expect(timeToMinutes("00:00", "end")).toBe(MINUTES_IN_DAY);
    expect(timeToMinutes("00:00", "start")).toBe(0);
    expect(minutesToTime(MINUTES_IN_DAY)).toBe("24:00");
  });

  it("rejects anything that is not a valid time", () => {
    expect(timeToMinutes("", "start")).toBeNull();
    expect(timeToMinutes("25:00", "start")).toBeNull();
    expect(timeToMinutes("10:70", "start")).toBeNull();
    expect(timeToMinutes("24:30", "end")).toBeNull();
  });
});

describe("normalizeBusyBlocks", () => {
  it("merges blocks that overlap or just touch", () => {
    expect(
      normalizeBusyBlocks([
        block(1, h(9), h(13)),
        block(1, h(12), h(14)), // solapa
        block(1, h(14), h(15)), // pegado
      ])
    ).toEqual([block(1, h(9), h(15))]);
  });

  it("keeps separate blocks of the same day apart, in order", () => {
    expect(
      normalizeBusyBlocks([block(1, h(15), h(18)), block(1, h(9), h(13))])
    ).toEqual([block(1, h(9), h(13)), block(1, h(15), h(18))]);
  });

  it("never merges across days", () => {
    const blocks = normalizeBusyBlocks([block(1, h(9), h(17)), block(2, h(9), h(17))]);
    expect(blocks).toHaveLength(2);
  });

  it("drops blocks that end before they start or fall outside the day", () => {
    expect(
      normalizeBusyBlocks([
        block(1, h(17), h(9)),
        block(1, h(9), h(9)),
        block(9, h(9), h(17)),
        block(1, h(9), MINUTES_IN_DAY + 1),
      ])
    ).toEqual([]);
  });

  it("returns the week ordered from Monday to Sunday", () => {
    const blocks = normalizeBusyBlocks([block(0, h(9), h(10)), block(1, h(9), h(10))]);
    expect(blocks.map((b) => b.weekday)).toEqual([1, 0]);
  });
});

describe("summarizeAvailability", () => {
  it("falls back to the waking day when nothing is configured", () => {
    const summary = summarizeAvailability([]);
    expect(summary.configured).toBe(false);
    expect(summary.days).toEqual([]);
    expect(summary.averageFreeHours).toBe(24 - SLEEP_HOURS);
  });

  it("discounts sleep and busy hours on the day they fall on", () => {
    const summary = summarizeAvailability([block(1, h(9), h(17))]);
    const monday = summary.days.find((d) => d.day === "monday");
    const tuesday = summary.days.find((d) => d.day === "tuesday");

    expect(summary.configured).toBe(true);
    expect(monday).toMatchObject({
      busy: ["09:00-17:00"],
      busyHours: 8,
      freeHours: 24 - SLEEP_HOURS - 8,
    });
    expect(tuesday).toMatchObject({ busy: [], busyHours: 0, freeHours: 24 - SLEEP_HOURS });
  });

  it("counts overlapping blocks once", () => {
    const summary = summarizeAvailability([
      block(1, h(9), h(13)),
      block(1, h(12), h(17)),
    ]);
    expect(summary.days.find((d) => d.day === "monday")?.busyHours).toBe(8);
  });

  it("never reports negative free hours", () => {
    const summary = summarizeAvailability([block(1, 0, MINUTES_IN_DAY)]);
    expect(summary.days.find((d) => d.day === "monday")?.freeHours).toBe(0);
  });

  it("covers the seven days even when only one is busy", () => {
    const summary = summarizeAvailability([block(1, h(9), h(17))]);
    expect(summary.days.map((d) => d.day)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]);
  });
});
