import type { RecurrenceType } from "@/lib/recurrence";

export type TaskStatus = "pending" | "yes" | "no";
export type HabitLogStatus = "completed" | "missed";
export type Priority = 1 | 2 | 3 | 4;

export type Category = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  position: number;
  icon: string;
  color: string | null;
  created_at: string;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
};

export type TaskImage = {
  id: string;
  task_id: string;
  storage_path: string;
  position: number;
  signed_url?: string;
};

export type Task = {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  description: string | null;
  link: string | null;
  due_date: string; // yyyy-MM-dd
  priority: Priority;
  status: TaskStatus;
  completed_at: string | null;
  pomodoro_minutes: number;
  recurrence_type: RecurrenceType;
  recurrence_weekdays: number[] | null;
  recurrence_interval: number;
  recurrence_parent_id: string | null;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
  task_images?: TaskImage[];
};

export type CompletedTask = Task & {
  categories: Pick<Category, "id" | "name" | "color" | "icon" | "is_default"> | null;
};

export type TaskCompletion = {
  id: string;
  task_id: string | null;
  title_snapshot: string;
  status: Exclude<TaskStatus, "pending">;
  due_date: string;
  completed_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string; // yyyy-MM-dd
  target_days: number | null;
  end_date: string | null;
  punishment_enabled: boolean;
  created_at: string;
  habit_tasks?: { task_id: string }[];
};

export type HabitLog = {
  id: string;
  habit_id: string;
  log_date: string; // yyyy-MM-dd
  status: HabitLogStatus;
};

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

/**
 * Un tramo de tiempo ocupado de la semana tipo del usuario, en minutos desde
 * medianoche e intervalo semiabierto `[start_minute, end_minute)`. 1440 es el
 * fin del día. Ver `lib/availability.ts`.
 */
export type BusyBlock = {
  id: string;
  user_id: string;
  /** 0 = domingo .. 6 = sábado */
  weekday: number;
  start_minute: number;
  end_minute: number;
};
