"use client";

import { Flame, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CompletedSection } from "@/components/home/CompletedSection";
import { MotivationalCard } from "@/components/home/MotivationalCard";
import { TaskSection } from "@/components/home/TaskSection";
import { TodayProgress } from "@/components/home/TodayProgress";
import { CompletedTaskRow } from "@/components/tasks/CompletedTaskRow";
import { TaskBoard, TaskRows, useTaskBoard } from "@/components/tasks/TaskBoard";
import { useT } from "@/lib/i18n/locale-context";
import {
  partitionTasks,
  sortByDateAndPriority,
  sortCompletedToday,
} from "@/lib/tasks";
import type { Category, Task } from "@/lib/types";

type HomeContentProps = {
  userName: string;
  hour: number;
  today: string;
  dayOfYear: number;
  /** All pending tasks; sections are derived client-side so moves are instant */
  tasks: Task[];
  completedToday: Task[];
  categories: Category[];
  bestStreak: number;
};

export function HomeContent(props: HomeContentProps) {
  return (
    <TaskBoard
      categories={props.categories}
      today={props.today}
      initialTasks={props.tasks}
      initialCompletedToday={props.completedToday}
    >
      <HomeSections {...props} />
    </TaskBoard>
  );
}

function HomeSections({
  userName,
  hour,
  today,
  dayOfYear,
  categories,
  bestStreak,
}: HomeContentProps) {
  const t = useT();
  const board = useTaskBoard();

  const greeting =
    hour < 12
      ? t.home.greetingMorning
      : hour < 19
        ? t.home.greetingAfternoon
        : t.home.greetingEvening;

  const { pending, upcoming } = partitionTasks(board.tasks, today);
  const completedToday = sortCompletedToday(board.completedToday);
  const done = completedToday.length;

  return (
    <div className="space-y-6" data-testid="home">
      <header className="glow-primary flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">
              {greeting}
              {userName ? `, ${userName.split(" ")[0]}` : ""}
            </span>
          </h1>
          {bestStreak > 0 && (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <Flame className="size-4 text-streak" />
              <span className="gradient-streak bg-clip-text text-transparent">
                {bestStreak} {t.home.streak}
              </span>
            </p>
          )}
        </div>
        <Button onClick={() => board.openNewTask()} data-testid="new-task">
          <Plus className="size-4" />
          {t.tasks.newTask}
        </Button>
      </header>

      <MotivationalCard dayOfYear={dayOfYear} />

      <TaskSection
        id="pending"
        title={t.home.pending}
        count={pending.length}
        emptyMessage={t.home.emptyPending}
        aside={<TodayProgress done={done} total={done + pending.length} />}
        footer={completedToday.map((task) => (
          <CompletedTaskRow key={task.id} task={task} />
        ))}
      >
        <TaskRows tasks={pending} />
      </TaskSection>

      <TaskSection
        id="upcoming"
        title={t.home.upcoming}
        count={upcoming.length}
        emptyMessage={t.home.emptyUpcoming}
      >
        <TaskRows tasks={upcoming} />
      </TaskSection>

      {categories.map((category) => {
        const categoryTasks = sortByDateAndPriority(
          board.tasks.filter((task) => task.category_id === category.id)
        );
        return (
          <TaskSection
            key={category.id}
            id={`cat-${category.id}`}
            title={
              <>
                <CategoryIcon
                  icon={category.icon}
                  color={category.color}
                  className="size-4 shrink-0"
                />
                <span className="truncate">
                  {category.is_default ? t.categories.general : category.name}
                </span>
              </>
            }
            accentColor={category.color}
            count={categoryTasks.length}
            emptyMessage={t.home.emptyList}
          >
            <TaskRows tasks={categoryTasks} />
          </TaskSection>
        );
      })}

      <CompletedSection showCategory />
    </div>
  );
}
