import { describe, expect, it } from "vitest";
import { getNextDueDate, type RecurrenceConfig } from "@/lib/recurrence";

function config(partial: Partial<RecurrenceConfig>): RecurrenceConfig {
  return {
    recurrence_type: "none",
    recurrence_weekdays: null,
    recurrence_interval: 1,
    ...partial,
  };
}

describe("getNextDueDate", () => {
  it("returns null for one-time tasks", () => {
    expect(getNextDueDate(config({}), "2026-08-14")).toBeNull();
  });

  describe("daily", () => {
    it("moves to the next day when every weekday is allowed", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "daily" }), "2026-08-14")
      ).toBe("2026-08-15");
    });

    it("skips to the next allowed weekday", () => {
      // 2026-08-14 is a Friday (5); only Mon(1) and Wed(3) allowed
      expect(
        getNextDueDate(
          config({ recurrence_type: "daily", recurrence_weekdays: [1, 3] }),
          "2026-08-14"
        )
      ).toBe("2026-08-17");
    });

    it("wraps around the week", () => {
      // Friday with only Friday allowed -> next Friday
      expect(
        getNextDueDate(
          config({ recurrence_type: "daily", recurrence_weekdays: [5] }),
          "2026-08-14"
        )
      ).toBe("2026-08-21");
    });

    it("treats an empty weekday list as every day", () => {
      expect(
        getNextDueDate(
          config({ recurrence_type: "daily", recurrence_weekdays: [] }),
          "2026-08-14"
        )
      ).toBe("2026-08-15");
    });
  });

  describe("weekly", () => {
    it("adds one week by default", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "weekly" }), "2026-08-14")
      ).toBe("2026-08-21");
    });

    it("adds N weeks", () => {
      expect(
        getNextDueDate(
          config({ recurrence_type: "weekly", recurrence_interval: 3 }),
          "2026-08-14"
        )
      ).toBe("2026-09-04");
    });

    it("defends against interval 0", () => {
      expect(
        getNextDueDate(
          config({ recurrence_type: "weekly", recurrence_interval: 0 }),
          "2026-08-14"
        )
      ).toBe("2026-08-21");
    });
  });

  describe("monthly", () => {
    it("adds one month", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "monthly" }), "2026-08-14")
      ).toBe("2026-09-14");
    });

    it("clamps Jan 31 to the end of February", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "monthly" }), "2026-01-31")
      ).toBe("2026-02-28");
    });

    it("clamps to Feb 29 on leap years", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "monthly" }), "2028-01-31")
      ).toBe("2028-02-29");
    });
  });

  describe("yearly", () => {
    it("adds one year", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "yearly" }), "2026-08-14")
      ).toBe("2027-08-14");
    });

    it("clamps Feb 29 to Feb 28 on non-leap years", () => {
      expect(
        getNextDueDate(config({ recurrence_type: "yearly" }), "2028-02-29")
      ).toBe("2029-02-28");
    });
  });
});
