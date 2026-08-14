import { describe, expect, it } from "vitest";
import { partitionTasks, sortByDateAndPriority, sortByPriority } from "@/lib/tasks";
import type { Task } from "@/lib/types";

let seq = 0;
function task(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    user_id: "u1",
    category_id: "c1",
    title: `Task ${seq}`,
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
    ...partial,
  };
}

const TODAY = "2026-08-14";

describe("sortByPriority", () => {
  it("orders 1 first, ties by due date", () => {
    const t1 = task({ priority: 3, due_date: "2026-08-14" });
    const t2 = task({ priority: 1, due_date: "2026-08-20" });
    const t3 = task({ priority: 3, due_date: "2026-08-10" });
    const sorted = sortByPriority([t1, t2, t3]);
    expect(sorted.map((t) => t.id)).toEqual([t2.id, t3.id, t1.id]);
  });
});

describe("sortByDateAndPriority", () => {
  it("orders by nearest date, ties by priority", () => {
    const a = task({ due_date: "2026-08-20", priority: 1 });
    const b = task({ due_date: "2026-08-15", priority: 4 });
    const c = task({ due_date: "2026-08-15", priority: 2 });
    const sorted = sortByDateAndPriority([a, b, c]);
    expect(sorted.map((t) => t.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe("partitionTasks", () => {
  it("puts today and overdue in pending, future in upcoming", () => {
    const overdue = task({ due_date: "2026-08-01" });
    const today = task({ due_date: TODAY });
    const future = task({ due_date: "2026-08-30" });
    const done = task({ due_date: TODAY, status: "yes" });

    const { pending, upcoming } = partitionTasks([overdue, today, future, done], TODAY);
    expect(pending.map((t) => t.id)).toContain(overdue.id);
    expect(pending.map((t) => t.id)).toContain(today.id);
    expect(pending.map((t) => t.id)).not.toContain(done.id);
    expect(upcoming.map((t) => t.id)).toEqual([future.id]);
  });

  it("sorts pending by priority and upcoming by date", () => {
    const p4 = task({ due_date: TODAY, priority: 4 });
    const p1 = task({ due_date: "2026-08-02", priority: 1 });
    const far = task({ due_date: "2026-12-01", priority: 1 });
    const near = task({ due_date: "2026-08-20", priority: 3 });

    const { pending, upcoming } = partitionTasks([p4, p1, far, near], TODAY);
    expect(pending[0].id).toBe(p1.id);
    expect(upcoming[0].id).toBe(near.id);
  });
});
